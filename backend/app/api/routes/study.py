import os
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.study import StudyMaterial, StudySettings, StudySubject
from app.models.user import User

router = APIRouter(tags=["study"])
TYPES = {"lecture", "exercise", "lab"}


def _mat(m: StudyMaterial) -> dict:
    return {
        "id": str(m.id),
        "subjectId": str(m.subject_id),
        "type": m.type,
        "title": m.title,
        "createdAt": m.created_at.isoformat() if m.created_at else datetime.now(timezone.utc).isoformat(),
        "updatedAt": m.updated_at.isoformat() if m.updated_at else datetime.now(timezone.utc).isoformat(),
    }


def _subject(s: StudySubject, materials: list[StudyMaterial]) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "createdAt": s.created_at.isoformat() if s.created_at else datetime.now(timezone.utc).isoformat(),
        "materials": [_mat(m) for m in materials if m.subject_id == s.id],
    }


class NameBody(BaseModel):
    name: str


class MaterialBody(BaseModel):
    type: str
    title: str = "Без названия"
    body: str = ""


class MaterialPatch(BaseModel):
    title: str | None = None
    body: str | None = None


class SettingsBody(BaseModel):
    openRouterApiKey: str | None = None
    deepseekApiKey: str | None = None


class TextBody(BaseModel):
    text: str


@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db), _user: User = Depends(get_current_user)):
    row = await db.get(StudySettings, 1)
    key = row.openrouter_key if row else os.environ.get("OPENROUTER_API_KEY", "")
    return {"hasKey": bool(key), "openRouterApiKey": key, "deepseekApiKey": key}


@router.put("/settings")
async def put_settings(payload: SettingsBody, db: AsyncSession = Depends(get_db), _user: User = Depends(get_current_user)):
    key = payload.openRouterApiKey or payload.deepseekApiKey or ""
    row = await db.get(StudySettings, 1)
    if row is None:
        row = StudySettings(id=1, openrouter_key=key)
        db.add(row)
    else:
        row.openrouter_key = key
    await db.commit()
    return {"ok": True, "hasKey": bool(key)}


@router.get("/subjects")
async def list_subjects(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    subs = (await db.execute(select(StudySubject).where(StudySubject.user_id == user.id))).scalars().all()
    mats = (await db.execute(select(StudyMaterial).where(StudyMaterial.user_id == user.id))).scalars().all()
    return [_subject(s, mats) for s in subs]


@router.post("/subjects", status_code=201)
async def create_subject(payload: NameBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Укажи название предмета")
    s = StudySubject(id=uuid.uuid4(), user_id=user.id, name=name)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _subject(s, [])


@router.patch("/subjects/{subject_id}")
async def rename_subject(subject_id: uuid.UUID, payload: NameBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = await db.get(StudySubject, subject_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "Предмет не найден")
    s.name = payload.name.strip()
    await db.commit()
    mats = (await db.execute(select(StudyMaterial).where(StudyMaterial.subject_id == s.id))).scalars().all()
    return _subject(s, mats)


@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = await db.get(StudySubject, subject_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "Предмет не найден")
    await db.delete(s)
    await db.commit()
    return {"ok": True}


@router.post("/subjects/{subject_id}/materials", status_code=201)
async def create_material(subject_id: uuid.UUID, payload: MaterialBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.type not in TYPES:
        raise HTTPException(400, "Неверный тип")
    s = await db.get(StudySubject, subject_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "Предмет не найден")
    m = StudyMaterial(
        id=uuid.uuid4(),
        user_id=user.id,
        subject_id=subject_id,
        type=payload.type,
        title=payload.title.strip() or "Без названия",
        body=payload.body,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return {"meta": _mat(m), "body": m.body}


@router.get("/subjects/{subject_id}/materials/{material_id}")
async def read_material(subject_id: uuid.UUID, material_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(StudyMaterial, material_id)
    if m is None or m.user_id != user.id or m.subject_id != subject_id:
        raise HTTPException(404, "Материал не найден")
    return {"meta": _mat(m), "body": m.body}


@router.patch("/subjects/{subject_id}/materials/{material_id}")
async def update_material(subject_id: uuid.UUID, material_id: uuid.UUID, payload: MaterialPatch, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(StudyMaterial, material_id)
    if m is None or m.user_id != user.id or m.subject_id != subject_id:
        raise HTTPException(404, "Материал не найден")
    if payload.title is not None:
        m.title = payload.title.strip() or "Без названия"
    if payload.body is not None:
        m.body = payload.body
    await db.commit()
    await db.refresh(m)
    return {"meta": _mat(m), "body": m.body}


@router.delete("/subjects/{subject_id}/materials/{material_id}")
async def delete_material(subject_id: uuid.UUID, material_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(StudyMaterial, material_id)
    if m is None or m.user_id != user.id or m.subject_id != subject_id:
        raise HTTPException(404, "Материал не найден")
    await db.delete(m)
    await db.commit()
    return {"ok": True}


@router.get("/export-bundle")
async def export_bundle(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    subs = (await db.execute(select(StudySubject).where(StudySubject.user_id == user.id))).scalars().all()
    mats = (await db.execute(select(StudyMaterial).where(StudyMaterial.user_id == user.id))).scalars().all()
    files = []
    folders = {"lecture": "лекция", "exercise": "упражнение", "lab": "лабораторная"}
    for s in subs:
        for m in mats:
            if m.subject_id != s.id:
                continue
            files.append({
                "relativePath": f"{s.name}/{folders.get(m.type, m.type)}/{m.title}.md",
                "body": f"# {m.title}\n\n{m.body.strip()}\n",
            })
    return {"files": files}


@router.post("/export-local")
async def export_local(_user: User = Depends(get_current_user)):
    raise HTTPException(400, "На облаке папка ПК недоступна. Нажми «Выбрать папку…»")


@router.post("/ai/structure")
async def ai_structure(payload: TextBody, db: AsyncSession = Depends(get_db), _user: User = Depends(get_current_user)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(400, "Пустой текст")
    row = await db.get(StudySettings, 1)
    key = (row.openrouter_key if row else "") or os.environ.get("OPENROUTER_API_KEY", "")
    if not key:
        raise HTTPException(400, "Нет ключа OpenRouter")
    snippet = text[:6000]
    async with httpx.AsyncClient(timeout=50) as client:
        res = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://easy-study.vercel.app",
                "X-Title": "Easy Study",
            },
            json={
                "model": "dots-studio/dots-3-note-preview:free",
                "temperature": 0,
                "max_tokens": 2500,
                "messages": [
                    {
                        "role": "system",
                        "content": "Оформи конспект. Не меняй слова. Формат:\nTITLE: заголовок\n---\nтекст с нумерацией",
                    },
                    {"role": "user", "content": snippet},
                ],
            },
        )
    data = res.json()
    if res.status_code >= 400:
        raise HTTPException(502, data.get("error", {}).get("message") or f"HTTP {res.status_code}")
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    title = "Без названия"
    structured = text
    if "---" in content:
        head, rest = content.split("---", 1)
        if "TITLE:" in head:
            title = head.split("TITLE:", 1)[1].strip() or title
        structured = rest.strip() or text
    return {"title": title, "structured": structured, "wordsChanged": False}


@router.post("/auth/logout")
async def logout():
    return {"ok": True}
