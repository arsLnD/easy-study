import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Wallet2 } from "lucide-react";
import { fetchMe, register } from "@/api/auth";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { useAuthStore } from "@/store/authStore";

export function RegisterPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов");
      return;
    }

    setLoading(true);
    try {
      const tokens = await register(email, password, fullName);
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await fetchMe();
      setUser(user);
      navigate("/plan");
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError("Пользователь с таким email уже зарегистрирован");
      } else {
        setError("Не удалось создать аккаунт. Проверьте данные.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Wallet2 size={28} />
        </div>
        <h1 className="text-2xl font-extrabold">Создать аккаунт</h1>
        <p className="text-center text-sm text-textSecondary">
          Начните планировать бюджет уже сегодня
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <Input
          label="Имя"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Как вас зовут?"
        />
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <Input
          label="Пароль"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Минимум 8 символов"
        />
        {error && <p className="text-sm text-expense">{error}</p>}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-textSecondary">
        Уже есть аккаунт?{" "}
        <Link to="/login" className="font-semibold text-primary">
          Войти
        </Link>
      </p>
    </div>
  );
}
