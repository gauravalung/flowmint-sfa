import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, ApiRequestError } from "../auth/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await login(employeeCode.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Flowmint Admin</h1>
        <p>Sign in with your ADMIN employee code.</p>

        {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

        <div className="form-field" style={{ marginBottom: 12 }}>
          <label htmlFor="employeeCode">Employee code</label>
          <input
            id="employeeCode"
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </div>

        <div className="form-field" style={{ marginBottom: 20 }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
