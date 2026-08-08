import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { fetchMe } from "@/api/auth";
import { Loader } from "@/components/common/Loader";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { GoalsPage } from "@/pages/GoalsPage";
import { LoginPage } from "@/pages/LoginPage";
import { PlanPage } from "@/pages/PlanPage";
import { PreferencesPage } from "@/pages/PreferencesPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { RegisterPage } from "@/pages/RegisterPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TrackerPage } from "@/pages/TrackerPage";
import { useAuthStore } from "@/store/authStore";

/**
 * Обёртка защищённых маршрутов: если пользователь не авторизован —
 * отправляем на /login. При наличии access_token, но отсутствии загруженного
 * профиля (например, после перезагрузки страницы), сначала подгружаем
 * профиль через /api/auth/me, чтобы везде в приложении был доступен
 * актуальный user.settings.
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [checking, setChecking] = useState(!user && Boolean(accessToken));

  useEffect(() => {
    if (accessToken && !user) {
      fetchMe()
        .then(setUser)
        .catch(() => logout())
        .finally(() => setChecking(false));
    }
  }, [accessToken, user, setUser, logout]);

  if (!accessToken) return <Navigate to="/login" replace />;
  if (checking) return <Loader label="Загружаем ваш профиль..." />;

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/plan" element={<ProtectedRoute><PlanPage /></ProtectedRoute>} />
      <Route path="/tracker" element={<ProtectedRoute><TrackerPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/settings/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/settings/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
      <Route path="/settings/goals" element={<ProtectedRoute><GoalsPage /></ProtectedRoute>} />
      <Route path="/settings/preferences" element={<ProtectedRoute><PreferencesPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/plan" replace />} />
    </Routes>
  );
}
