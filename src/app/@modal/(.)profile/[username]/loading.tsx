import { SheetFrame } from "./ProfileSheet";

// Shown the instant a board row is clicked, while the server renders the
// sheet. Same frame and block heights as ProfileSheet, so the swap doesn't jump.
export default function SheetLoading() {
  return (
    <SheetFrame>
      <div className="flex items-center justify-center px-5 pt-3 pb-2 border-b border-line h-[49px]">
        <span className="w-10 h-1 rounded-full bg-line-2 sm:invisible" aria-hidden />
      </div>
      <div className="px-5 pt-5 pb-5 flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="Loading profile">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-[12px] bg-raised" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-raised" />
            <div className="h-3.5 w-28 rounded bg-raised" />
          </div>
        </div>
        <div className="h-[76px] rounded-[12px] border border-line bg-raised/40" />
        <div className="h-[98px] rounded-[12px] border border-line bg-raised/40" />
        <div className="h-[62px] rounded-[12px] border border-line bg-raised/40" />
        <div className="h-10 rounded-md bg-raised" />
      </div>
    </SheetFrame>
  );
}
