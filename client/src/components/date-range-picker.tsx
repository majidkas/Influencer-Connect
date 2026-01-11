import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDate } from "@/lib/date-context";
import { useI18n } from "@/lib/i18nContext";

export function DateRangePicker({ className }: { className?: string }) {
  const { date, setDate } = useDate();
  const { language } = useI18n();

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y", { locale: language === 'fr' ? fr : enUS })} -{" "}
                  {format(date.to, "LLL dd, y", { locale: language === 'fr' ? fr : enUS })}
                </>
              ) : (
                format(date.from, "LLL dd, y", { locale: language === 'fr' ? fr : enUS })
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            locale={language === 'fr' ? fr : enUS}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}