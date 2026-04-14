/*
  AUTH PAGE - Login & Registration
  ================================
  Beautiful, responsive authentication form with error handling
 */
import { useState } from "react";
import styles from "./AuthPage.module.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface Props {
  onLogin: (user: any, token: string) => void;
}

export default function AuthPage({ onLogin }: Props) {
  // AUTH STATE
  const [isLogin, setIsLogin] = useState(true); // Toggle login/register
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
    SUBMIT HANDLER - Login or Register
   */
  const submit = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const res = await fetch(API + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error");
        return;
      }

      // REGISTER SUCCESS - Switch to login
      if (!isLogin && !data.token) {
        setSuccess("✅ Account created! Now login with your credentials.");
        setIsLogin(true);
        setUsername("");
        setPassword("");
        return;
      }

      // LOGIN SUCCESS - Navigate to app
      if (data.token) {
        onLogin(data.user, data.token);
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        {/* TITLE */}
        <h1 className={styles.title}>
          {isLogin ? "Login 🎮" : "Create account ➕"}
        </h1>

        {/* USERNAME INPUT */}
        <input
          className={styles.input}
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        {/* PASSWORD INPUT */}
        <input
          className={styles.input}
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* ERROR MESSAGES */}
        {error && <p className={styles.error}>{error}</p>}

        {/* SUCCESS MESSAGES */}
        {success && <p className={styles.success}>{success}</p>}

        {/* SUBMIT BUTTON */}
        <button className={styles.button} onClick={submit} disabled={loading}>
          {loading ? "..." : isLogin ? "Login" : "Register"}
        </button>

        {/* TOGGLE LOGIN/REGISTER */}
        <p className={styles.switch} onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "No account? Register" : "Already have account? Login"}
        </p>
      </div>
    </div>
  );
}
