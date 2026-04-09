import { Button } from "@/components/ui/button";

type FillActionsProps = {
  disabled: boolean;
  isFilling: boolean;
};

export function FillActions({ disabled, isFilling }: FillActionsProps) {
  return (
    <Button type="submit" className="w-full" disabled={disabled}>
      {isFilling ? "Filling fields..." : "Fill Webpage Form"}
    </Button>
  );
}
