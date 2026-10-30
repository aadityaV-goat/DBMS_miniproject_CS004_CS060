"use client";
// When middleware sends STAFF away from an admin page it adds ?denied=1; say why.
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Notice() {
  const params = useSearchParams();
  if (params.get("denied") !== "1") return null;
  return (
    <p role="alert" className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
      That page is for admins only, so you were brought here instead.
    </p>
  );
}

export default function DeniedNotice() {
  return (
    <Suspense>
      <Notice />
    </Suspense>
  );
}
