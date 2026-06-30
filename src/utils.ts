export const isTeacherMatch = (entryTeacher: string | undefined | null, currentTeacher: string | undefined | null) => {
  if (!entryTeacher || !currentTeacher) return false;
  const t1 = entryTeacher.trim().toLowerCase();
  const t2 = currentTeacher.trim().toLowerCase();
  return t1 === t2 || t1.includes(t2) || t2.includes(t1);
};

export const cleanClass = (cls: string | undefined | null) => {
  if (!cls) return '';
  return cls.replace('Class ', '').trim();
};

export const cleanSection = (sec: string | undefined | null) => {
  if (!sec) return '';
  return sec.replace('Section ', '').trim();
};
