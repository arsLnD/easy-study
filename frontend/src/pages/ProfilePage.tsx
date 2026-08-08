import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import { changePassword, updateProfile } from "@/api/users";
import { useAuthStore } from "@/store/authStore";

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const updated = await updateProfile(fullName);
      if (user) setUser({ ...user, full_name: updated.full_name });
      setProfileMessage("Данные обновлены");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage("Пароль изменён");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setPasswordError("Не удалось изменить пароль. Проверьте текущий пароль.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <AppShell>
      <TopBar title="Профиль" back />
      <div className="flex flex-col gap-5 px-5">
        <Card>
          <h2 className="mb-3 text-base font-bold">Личные данные</h2>
          <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
            <Input label="Email" value={user?.email ?? ""} disabled />
            <Input label="Имя" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Сохраняем..." : "Сохранить"}
            </Button>
            {profileMessage && <p className="text-sm text-income">{profileMessage}</p>}
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-bold">Смена пароля</h2>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <Input
              label="Текущий пароль"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="Новый пароль"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
            <Button type="submit" variant="secondary" disabled={savingPassword}>
              {savingPassword ? "Сохраняем..." : "Изменить пароль"}
            </Button>
            {passwordMessage && <p className="text-sm text-income">{passwordMessage}</p>}
            {passwordError && <p className="text-sm text-expense">{passwordError}</p>}
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
