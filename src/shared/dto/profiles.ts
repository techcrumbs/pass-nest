export type ProfileDto = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateProfileInput = {
  name: string;
};

export type UpdateProfileInput = {
  id: string;
  name: string;
};
