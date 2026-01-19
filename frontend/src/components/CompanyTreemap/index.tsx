import { useMemo } from "react";
import { JurisdictionChart } from "../JurisdictionChart";
import { useCompanySubsidiaries } from "../../db/queries";

interface CompanyTreemapProps {
  companyId: string | null;
  onSubsidiaryClick?: (subsidiaryId: string) => void;
}

export function CompanyTreemap({ companyId, onSubsidiaryClick }: CompanyTreemapProps) {
  const { subsidiaries, isLoading } = useCompanySubsidiaries(companyId);

  const jurisdictionData = useMemo(() => {
    if (!subsidiaries || subsidiaries.length === 0) return [];

    // Filter out any null/undefined entries and group by jurisdiction
    const validSubsidiaries = subsidiaries.filter((sub): sub is NonNullable<typeof sub> => sub != null);

    const jurisdictionGroups = validSubsidiaries.reduce((groups, sub) => {
      const jurisdiction = sub.jurisdiction || "Unknown";

      if (!groups[jurisdiction]) {
        groups[jurisdiction] = [];
      }
      groups[jurisdiction].push({ id: sub.id, name: sub.name });
      return groups;
    }, {} as Record<string, { id: string; name: string }[]>);

    // Convert to chart format
    return Object.entries(jurisdictionGroups).map(([jurisdiction, subs]) => ({
      jurisdiction,
      count: subs.length,
      subsidiaries: subs,
    }));
  }, [subsidiaries]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"
          />
          <p className="text-sm text-muted-foreground">Loading subsidiaries...</p>
        </div>
      </div>
    );
  }

  return (
    <JurisdictionChart
      data={jurisdictionData}
      onSubsidiaryClick={onSubsidiaryClick}
    />
  );
}