import { Button } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import type { Suggestion } from "@/types/domain";

export function SuggestionPanel({
  suggestions,
  canManage,
}: {
  suggestions: Suggestion[];
  canManage: boolean;
}) {
  return (
    <Card>
      <SectionTitle
        title="Member suggestions"
        subtitle="Suggestions are ideas for the host. They are not voteable until added as official poll options."
      />
      <div className="flex gap-2">
        <input
          className="min-h-10 flex-1 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-900"
          placeholder="Suggest an option"
        />
        <Button tone="primary">Submit</Button>
      </div>
      <div className="mt-4 space-y-3">
        {suggestions.length ? (
          suggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-md border border-zinc-200 p-3">
              <div className="mb-1 text-xs font-medium uppercase text-zinc-500">
                Suggestion
              </div>
              <p className="text-sm text-zinc-900">{suggestion.text}</p>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
                <span>{suggestion.authorName}</span>
                {canManage ? <Button className="min-h-8 px-2 py-1">Add as official option</Button> : null}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No suggestions yet.</p>
        )}
      </div>
    </Card>
  );
}
