import { redirect } from "next/navigation";

/** AI suggestions wait on the quick entry they came from; old links to the former inbox land on the entry list. */
export default function ActionsPage() {
  redirect("/entries");
}
