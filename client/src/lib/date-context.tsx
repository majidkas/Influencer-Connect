import React, { createContext, useContext, useState, ReactNode } from "react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";

interface DateContextType {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
  from: string; 
  to: string;   
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export function DateProvider({ children }: { children: ReactNode }) {
  // Par défaut : Les 30 derniers jours
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Formatage ISO pour l'API (début de journée -> fin de journée)
  const from = date?.from ? startOfDay(date.from).toISOString() : "";
  const to = date?.to ? endOfDay(date.to).toISOString() : "";

  return (
    <DateContext.Provider value={{ date, setDate, from, to }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDate() {
  const context = useContext(DateContext);
  if (!context) {
    throw new Error("useDate must be used within a DateProvider");
  }
  return context;
}