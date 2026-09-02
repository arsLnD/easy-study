export type MaterialType = "lecture" | "exercise" | "lab";

export type MaterialMeta = {
  id: string;
  subjectId: string;
  type: MaterialType;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Subject = {
  id: string;
  name: string;
  createdAt: string;
  materials: MaterialMeta[];
};

export type StructureResult = {
  title: string;
  structured: string;
  wordsChanged: boolean;
  warning?: string;
};
