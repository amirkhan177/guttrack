export default function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div
      style={{
        background: "#15151f",
        borderRadius: 18,
        border: "1px solid #1e1e2e",
        height,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}
