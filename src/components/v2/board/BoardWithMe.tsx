"use client";

import Board, { type BoardProps } from "./Board";
import { useMe } from "../useMe";

/** A board that highlights the visitor's row, for pages without a standing (records, fleets, tools). */
export default function BoardWithMe(props: Omit<BoardProps, "me" | "standing">) {
  const { me } = useMe();
  return <Board {...props} me={me} />;
}
