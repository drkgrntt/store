import { FC } from "react";
import LoginForm from "../../components/LoginForm";
import RegisterForm from "../../components/RegisterForm";

const Login: FC = () => {
  return (
    <div>
      <LoginForm />
      <RegisterForm />
    </div>
  );
};

export default Login;
