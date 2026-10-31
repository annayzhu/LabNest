"use client";

import { useEffect, useRef } from "react";

/** The header box of a selectable table: checks or clears every row, and shows a dash while only some are checked. */
export function SelectAllRows() {
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = box.current?.form;
    if (!form) return;
    const sync = () => {
      const rows = [...form.querySelectorAll<HTMLInputElement>("input.selection-checkbox")];
      const checked = rows.filter((row) => row.checked).length;
      if (!box.current) return;
      box.current.checked = rows.length > 0 && checked === rows.length;
      box.current.indeterminate = checked > 0 && checked < rows.length;
    };
    sync();
    form.addEventListener("change", sync);
    return () => form.removeEventListener("change", sync);
  }, []);

  return (
    <input
      ref={box}
      type="checkbox"
      aria-label="Select all rows"
      className="focus-ring ln-data-table-checkbox"
      onChange={(event) => {
        const form = event.currentTarget.form;
        if (!form) return;
        for (const row of form.querySelectorAll<HTMLInputElement>("input.selection-checkbox")) row.checked = event.currentTarget.checked;
        form.dispatchEvent(new Event("change", { bubbles: true }));
      }}
    />
  );
}
