import { FC } from "react";
import AddressList from "../../components/AddressList";
import { useIsAuth } from "../../hooks/useIsAuth";
import { useUser } from "../../hooks/useUser";

const Profile: FC = () => {
  useIsAuth();
  const { data: { me: user } = {} } = useUser();
  console.log({ user });

  if (!user) return null;

  return (
    <div>
      <AddressList addresses={user.addresses} />
    </div>
  );
};

export default Profile;
