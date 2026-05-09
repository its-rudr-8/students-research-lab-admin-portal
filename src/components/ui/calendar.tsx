import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format, setMonth, setYear, addYears, subYears, startOfMonth, endOfMonth } from "date-fns";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const [view, setView] = React.useState<"date" | "month" | "year">("date");
  
  const initialDate = (props.month as Date) || (props.selected as Date) || props.defaultMonth || new Date();
  const [internalMonth, setInternalMonth] = React.useState<Date>(initialDate);
  
  const calendarMonth = (props.month as Date) || internalMonth;
  
  const handleMonthChange = (m: Date) => {
    setInternalMonth(m);
    if (props.onMonthChange) props.onMonthChange(m);
  };

  const [yearGridStart, setYearGridStart] = React.useState(Math.floor(calendarMonth.getFullYear() / 12) * 12);

  React.useEffect(() => {
    if (props.selected && props.selected instanceof Date) {
      setInternalMonth(props.selected);
      setYearGridStart(Math.floor(props.selected.getFullYear() / 12) * 12);
    }
  }, [props.selected]);

  const isMonthDisabled = (d: Date) => {
    if (typeof props.disabled !== "function") return false;
    return props.disabled(startOfMonth(d)) && props.disabled(endOfMonth(d));
  };

  const isYearDisabled = (y: number) => {
    if (typeof props.disabled !== "function") return false;
    return props.disabled(new Date(y, 0, 1)) && props.disabled(new Date(y, 11, 31));
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = setMonth(calendarMonth, i);
    return {
      value: i,
      label: format(d, "MMM"),
      date: d,
      disabled: isMonthDisabled(d),
    };
  });

  const years = Array.from({ length: 12 }, (_, i) => {
    const y = yearGridStart + i;
    const d = setYear(calendarMonth, y);
    return {
      value: y,
      label: y.toString(),
      date: d,
      disabled: isYearDisabled(y),
    };
  });

  if (view === "month") {
    return (
      <div className={cn("p-3 space-y-4 min-w-[276px]", className)}>
        <div className="flex justify-between pt-1 relative items-center">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1")}
            onClick={() => handleMonthChange(subYears(calendarMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div 
            className="text-sm font-medium mx-auto flex items-center gap-1 cursor-pointer hover:text-[#8B735B]/70 transition-colors" 
            onClick={() => setView("year")}
          >
            {calendarMonth.getFullYear()}
          </div>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1")}
            onClick={() => handleMonthChange(addYears(calendarMonth, 1))}
            disabled={isYearDisabled(calendarMonth.getFullYear() + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-y-4 gap-x-2 mt-4">
          {months.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={m.disabled}
              onClick={() => {
                handleMonthChange(setMonth(calendarMonth, m.value));
                setView("date");
              }}
              className={cn(
                "h-10 w-full rounded-full text-sm font-medium hover:bg-[#EAD8C0]/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                calendarMonth.getMonth() === m.value && "bg-[#EAD8C0] text-[#8B735B] hover:bg-[#d4bc9a]"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === "year") {
    return (
      <div className={cn("p-3 space-y-4 min-w-[276px]", className)}>
        <div className="flex justify-between pt-1 relative items-center">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1")}
            onClick={() => setYearGridStart(y => y - 12)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-medium mx-auto">
            {yearGridStart} - {yearGridStart + 11}
          </div>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1")}
            onClick={() => setYearGridStart(y => y + 12)}
            disabled={isYearDisabled(yearGridStart + 12)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-y-4 gap-x-2 mt-4">
          {years.map((y) => (
            <button
              key={y.value}
              type="button"
              disabled={y.disabled}
              onClick={() => {
                handleMonthChange(setYear(calendarMonth, y.value));
                setView("month");
              }}
              className={cn(
                "h-10 w-full rounded-full text-sm font-medium hover:bg-[#EAD8C0]/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                calendarMonth.getFullYear() === y.value && "bg-[#EAD8C0] text-[#8B735B] hover:bg-[#d4bc9a]"
              )}
            >
              {y.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      month={calendarMonth}
      onMonthChange={handleMonthChange}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden", 
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-full [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-full transition-colors hover:bg-[#EAD8C0]/40"),
        day_range_end: "day-range-end",
        day_selected:
          "!bg-[#EAD8C0] !text-[#8B735B] hover:!bg-[#d4bc9a] focus:!bg-[#EAD8C0] rounded-full",
        day_today: "bg-[#FAF7F2] text-[#8B735B] font-bold border border-[#EAD8C0]/50",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed hover:bg-transparent",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        CaptionLabel: ({ displayMonth }) => {
          return (
            <div className="flex gap-1 items-center justify-center text-sm font-bold text-[#8B735B]">
              <button 
                type="button"
                className="cursor-pointer hover:bg-[#EAD8C0]/30 hover:text-[#8B735B] transition-colors px-2 py-1 rounded-md"
                onClick={() => setView("month")}
              >
                {format(displayMonth, "MMMM")}
              </button>
              <button 
                type="button"
                className="cursor-pointer hover:bg-[#EAD8C0]/30 hover:text-[#8B735B] transition-colors px-2 py-1 rounded-md"
                onClick={() => setView("year")}
              >
                {format(displayMonth, "yyyy")}
              </button>
            </div>
          );
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
