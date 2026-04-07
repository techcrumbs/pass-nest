export type EntryDto = {
  id: string;
  profileId: string;
  name: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateEntryInput = {
  profileId: string;
  name: string;
  password: string;
  tags: string[];
};
