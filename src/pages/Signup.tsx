import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function Signup() {
  const navigate = useNavigate();
  const { setAuthModalOpen, setAuthModalView, loading, user } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigate("/", { replace: true });
      } else {
        setAuthModalView("signup");
        setAuthModalOpen(true);
        navigate("/", { replace: true });
      }
    }
  }, [loading, user, navigate, setAuthModalOpen, setAuthModalView]);

  return null; // Don't render anything, it's just a redirect wrapper now
}
