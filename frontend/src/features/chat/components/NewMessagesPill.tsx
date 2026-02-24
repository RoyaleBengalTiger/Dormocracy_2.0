import { Button } from "@/components/ui/button";

export function NewMessagesPill({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <div className="pointer-events-none absolute bottom-24 left-0 right-0 flex justify-center">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="pointer-events-auto rounded-full"
        onClick={onClick}
        aria-label="Jump to new messages"
      >
        {count} new message{count === 1 ? "" : "s"}
      </Button>
    </div>
  );
}
