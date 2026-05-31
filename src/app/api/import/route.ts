import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { rowsToDeals } from "@/lib/import";

// POST /api/import  (multipart/form-data, field "file")
// Parses an uploaded .xlsx/.xls/.csv, auto-maps columns, returns analyzed deals.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) {
      return NextResponse.json({ error: "The file has no readable sheet." }, { status: 422 });
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const label = file.name.replace(/\.[^.]+$/, "") || "Imported";
    const result = rowsToDeals(rows, label);

    return NextResponse.json({
      ...result,
      fileName: file.name,
      sheet: wb.SheetNames[0],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not parse the spreadsheet." },
      { status: 500 }
    );
  }
}
