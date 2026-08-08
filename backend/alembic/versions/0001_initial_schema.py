"""initial schema

Создаёт все базовые таблицы приложения: users, user_settings, categories,
monthly_plans, plan_allocations, goals, goal_contributions, transactions,
motivational_quotes.

Revision ID: 0001
Revises:
Create Date: 2026-08-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # create_type=False потому что мы создаём типы сами, отдельным вызовом
    # ниже (с checkfirst=True) — если оставить стандартное поведение
    # (create_type=True), SQLAlchemy попытается создать тот же тип ЕЩЁ РАЗ
    # автоматически при create_table() и упадёт с "type already exists".
    category_type = postgresql.ENUM("expense", "income", name="category_type", create_type=False)
    category_type.create(op.get_bind(), checkfirst=True)
    entry_frequency = postgresql.ENUM("daily", "weekly", "custom", name="entry_frequency", create_type=False)
    entry_frequency.create(op.get_bind(), checkfirst=True)
    goal_status = postgresql.ENUM("active", "completed", "archived", name="goal_status", create_type=False)
    goal_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "user_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("default_currency", sa.String(3), server_default="RUB", nullable=False),
        sa.Column("entry_frequency", entry_frequency, server_default="weekly", nullable=False),
        sa.Column("custom_frequency_days", sa.Integer(), server_default="7", nullable=False),
        sa.Column("motivational_quotes_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("theme", sa.String(20), server_default="dark", nullable=False),
    )

    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("type", category_type, nullable=False),
        sa.Column("icon", sa.String(50), server_default="tag", nullable=False),
        sa.Column("color", sa.String(20), server_default="#7C5CFF", nullable=False),
        sa.Column("is_preset", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_essential", sa.Boolean(), server_default=sa.false(), nullable=False),
    )

    op.create_table(
        "monthly_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="RUB", nullable=False),
        sa.Column("total_income", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.UniqueConstraint("user_id", "month", name="uq_plan_user_month"),
    )

    op.create_table(
        "plan_allocations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("monthly_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("planned_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.UniqueConstraint("plan_id", "category_id", name="uq_allocation_plan_category"),
    )

    op.create_table(
        "goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("icon", sa.String(50), server_default="target", nullable=False),
        sa.Column("color", sa.String(20), server_default="#00E38C", nullable=False),
        sa.Column("currency", sa.String(3), server_default="RUB", nullable=False),
        sa.Column("target_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("status", goal_status, server_default="active", nullable=False),
    )

    op.create_table(
        "goal_contributions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("goals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("monthly_plans.id", ondelete="SET NULL"), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("contributed_on", sa.Date(), nullable=False),
        sa.Column("note", sa.String(255), nullable=True),
    )

    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("type", category_type, nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="RUB", nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("occurred_on", sa.Date(), nullable=False),
    )
    op.create_index("ix_transactions_user_occurred_on", "transactions", ["user_id", "occurred_on"])

    op.create_table(
        "motivational_quotes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("text", sa.String(500), nullable=False),
        sa.Column("author", sa.String(150), nullable=True),
        sa.Column("category", sa.String(30), server_default="general", nullable=False),
    )


def downgrade() -> None:
    op.drop_table("motivational_quotes")
    op.drop_index("ix_transactions_user_occurred_on", table_name="transactions")
    op.drop_table("transactions")
    op.drop_table("goal_contributions")
    op.drop_table("goals")
    op.drop_table("plan_allocations")
    op.drop_table("monthly_plans")
    op.drop_table("categories")
    op.drop_table("user_settings")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    postgresql.ENUM(name="goal_status").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="entry_frequency").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="category_type").drop(op.get_bind(), checkfirst=True)
