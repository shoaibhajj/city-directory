// src/components/business/owner-dashboard-stats.tsx
type Props = {
  total: number;
  draft: number;
  active: number;
  suspended: number;
};

export function OwnerDashboardStats({
  total,
  draft,
  active,
  suspended,
}: Props) {
  const items = [
    { label: "All listings", value: total },
    { label: "Draft", value: draft },
    { label: "Active", value: active },
    { label: "Suspended", value: suspended },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
