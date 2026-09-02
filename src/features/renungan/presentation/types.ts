export type ScriptureLookup = {
  ref: string;
  text: string | null;
  error: string | null;
};

export type RenunganDayEntry = {
  date: string;
  hasContent: boolean;
  imageUrl: string;
  id: string | null;
  title: string | null;
  content: string | null;
  scripture: ScriptureLookup | null;
};

export type RenunganMonthResponse = {
  month: string;
  days: RenunganDayEntry[];
};

export type RenunganFormState = {
  title: string;
  content: string;
  scriptureRef: string;
};
