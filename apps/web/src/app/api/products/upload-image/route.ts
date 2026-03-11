import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") || "http://localhost:4010";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { message: "No se recibió ninguna imagen" },
        { status: 400 }
      );
    }

    const auth = request.headers.get("authorization");
    const backendForm = new FormData();
    backendForm.append("file", file, file.name || "image");

    const res = await fetch(`${API_ORIGIN}/api/products/upload-image`, {
      method: "POST",
      headers: auth ? { Authorization: auth } : {},
      body: backendForm,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[api/products/upload-image] Error:", err);
    return NextResponse.json(
      { message: "Error al subir la imagen" },
      { status: 502 }
    );
  }
}
