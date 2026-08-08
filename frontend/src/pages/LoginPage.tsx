import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Wallet2 } from "lucide-react";
import { fetchMe, login } from "@/api/auth";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { useAuthStore } from "@/store/authStore";

// Бесплатный хостинг backend'а "засыпает" при неактивности и просыпается
// до ~40 секунд на первый запрос — показываем пояснение, чтобы это не
// выглядело как зависший/сломанный сайт.
const SLOW_SERVER_HINT_DELAY_MS = 4000;

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slowServerHint, setSlowServerHint] = useState(false);
  const slowHintTimer = useRef<ReturnType<typeof setTimeout>>();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSlowServerHint(false);
    slowHintTimer.current = setTimeout(() => setSlowServerHint(true), SLOW_SERVER_HINT_DELAY_MS);
    try {
      const tokens = await login(email, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await fetchMe();
      setUser(user);
      navigate("/plan");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        setError("Неверный email или пароль");
      } else if (status) {
        setError(`Сервер недоступен (код ${status}). Попробуйте ещё раз.`);
      } else {
        setError("Не удалось связаться с сервером. Проверьте подключение к интернету.");
      }
    } finally {
      clearTimeout(slowHintTimer.current);
      setSlowServerHint(false);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Wallet2 size={28} />
        </div>
        <h1 className="text-2xl font-extrabold">Plans/Finance</h1>
        <p className="text-center text-sm text-textSecondary">
          Планируйте бюджет, копите на цели и контролируйте траты
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
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
          placeholder="••••••••"
        />
        {error && <p className="text-sm text-expense">{error}</p>}
        {slowServerHint && (
          <p className="text-sm text-textSecondary">
            Сервер просыпается после простоя, это может занять до минуты — подождите, пожалуйста
          </p>
        )}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-textSecondary">
        Нет аккаунта?{" "}
        <Link to="/register" className="font-semibold text-primary">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
