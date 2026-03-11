import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4010/api";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ number: string }> }
) {
  const { number } = await context.params;
  const codeOrId = (number || "").trim();
  if (!codeOrId) {
    return NextResponse.json(
      { message: "Número o código de envío no válido" },
      { status: 400 }
    );
  }
  const url = `${API_URL.replace(/\/$/, "")}/shipment/${encodeURIComponent(codeOrId)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[api/shipment] Error fetching shipment:", err);
    return NextResponse.json(
      { message: "Error al conectar con el servidor" },
      { status: 502 }
    );
  }
}
