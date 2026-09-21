import { redirect } from "next/navigation";

/** QR-code target: /verify/CERT-XXXX-XXXX-XXXX → the verify page runs the lookup on load. */
export default async function VerifyByIdPage({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  redirect(`/verify?id=${encodeURIComponent(certId.toUpperCase())}`);
}
