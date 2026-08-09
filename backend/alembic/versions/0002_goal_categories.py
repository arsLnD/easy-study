"""goal categories: link goals to a dedicated expense category

Каждая цель теперь имеет привязанную категорию трат (categories.linked_goal_id).
Пополнение цели с этого момента — обычная трата (Transaction) в этой
категории, а не отдельная сущность GoalContribution вне плана. Это даёт:
  - единый список операций (пополнения видны в "Операции"/"По дням");
  - автоматический учёт пополнений в сводке "план vs факт" по категориям;
  - возможность редактировать/удалять пополнение как любую другую операцию.

Существующие данные goal_contributions переносятся в transactions (через
новую служебную категорию на каждую цель), после чего таблица
goal_contributions удаляется.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-09
"""

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "categories",
        sa.Column("linked_goal_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_categories_linked_goal_id_goals",
        "categories",
        "goals",
        ["linked_goal_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_unique_constraint("uq_categories_linked_goal_id", "categories", ["linked_goal_id"])

    bind = op.get_bind()

    goals = bind.execute(
        sa.text("SELECT id, user_id, name, icon, color, currency FROM goals")
    ).fetchall()

    for goal_id, user_id, name, icon, color, currency in goals:
        category_id = uuid.uuid4()
        bind.execute(
            sa.text(
                """
                INSERT INTO categories
                    (id, created_at, updated_at, user_id, name, type, icon, color,
                     is_preset, is_essential, linked_goal_id)
                VALUES
                    (:id, now(), now(), :user_id, :name, 'expense', :icon, :color,
                     false, false, :goal_id)
                """
            ),
            {
                "id": category_id,
                "user_id": user_id,
                "name": name,
                "icon": icon,
                "color": color,
                "goal_id": goal_id,
            },
        )

        contributions = bind.execute(
            sa.text(
                "SELECT id, amount, contributed_on, note FROM goal_contributions WHERE goal_id = :goal_id"
            ),
            {"goal_id": goal_id},
        ).fetchall()

        for _contribution_id, amount, contributed_on, note in contributions:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO transactions
                        (id, created_at, updated_at, user_id, category_id, type, amount,
                         currency, description, occurred_on)
                    VALUES
                        (:id, now(), now(), :user_id, :category_id, 'expense', :amount,
                         :currency, :description, :occurred_on)
                    """
                ),
                {
                    "id": uuid.uuid4(),
                    "user_id": user_id,
                    "category_id": category_id,
                    "amount": amount,
                    "currency": currency,
                    "description": note,
                    "occurred_on": contributed_on,
                },
            )

    op.drop_table("goal_contributions")


def downgrade() -> None:
    op.create_table(
        "goal_contributions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "goal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("goals.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("monthly_plans.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("contributed_on", sa.Date(), nullable=False),
        sa.Column("note", sa.String(255), nullable=True),
    )
    op.drop_constraint("uq_categories_linked_goal_id", "categories", type_="unique")
    op.drop_constraint("fk_categories_linked_goal_id_goals", "categories", type_="foreignkey")
    op.drop_column("categories", "linked_goal_id")
