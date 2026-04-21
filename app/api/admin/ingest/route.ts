import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const DATA_DIR = path.join(process.cwd(), "data", "events");

async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_auth")?.value === "admin_session_v1";
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { ticker, fiscal_quarter, transcript_text, transcript_source_url, action } = body;

  if (!ticker || !fiscal_quarter) {
    return NextResponse.json({ error: "ticker and fiscal_quarter required" }, { status: 400 });
  }

  const tickerDir = path.join(DATA_DIR, ticker.toUpperCase());
  const eventFile = path.join(tickerDir, `${fiscal_quarter}.json`);
  const transcriptFile = path.join(tickerDir, `${fiscal_quarter}-transcript.md`);

  // Read existing event
  let event: Record<string, unknown>;
  try {
    const raw = await fs.readFile(eventFile, "utf-8");
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Event file not found" }, { status: 404 });
  }

  if (action === "mark_unavailable") {
    event.transcript_status = "unavailable";
    await fs.writeFile(eventFile, JSON.stringify(event, null, 2));
    await commitToGit([eventFile], `chore: mark ${ticker} ${fiscal_quarter} transcript unavailable`);
    return NextResponse.json({ ok: true, status: "unavailable" });
  }

  if (!transcript_text?.trim()) {
    return NextResponse.json({ error: "transcript_text required for ingestion" }, { status: 400 });
  }

  // Write transcript file
  await fs.writeFile(transcriptFile, transcript_text, "utf-8");

  // Update event JSON
  event.transcript_status = "published";
  event.transcript_source_url = transcript_source_url ?? null;
  event.transcript_added_at = new Date().toISOString();
  await fs.writeFile(eventFile, JSON.stringify(event, null, 2));

  // Commit to git
  await commitToGit(
    [eventFile, transcriptFile],
    `feat: add transcript for ${ticker} ${fiscal_quarter}`
  );

  // Trigger AI summary extraction (fire-and-forget in background)
  triggerSummaryExtraction(ticker, fiscal_quarter);

  return NextResponse.json({ ok: true, status: "published" });
}

async function commitToGit(files: string[], message: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    // Local mode: just do git commit
    try {
      const fileList = files.join(" ");
      await execAsync(`git add ${fileList} && git commit -m "${message}"`, {
        cwd: process.cwd(),
        env: { ...process.env },
      });
    } catch (e) {
      console.warn("Local git commit failed:", e);
    }
    return;
  }

  // GitHub API commit
  const [owner, repoName] = repo.split("/");
  for (const file of files) {
    const relPath = path.relative(process.cwd(), file);
    try {
      const content = await fs.readFile(file);
      const base64 = content.toString("base64");

      // Get current SHA if file exists
      let sha: string | undefined;
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/contents/${relPath}`,
          { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" } }
        );
        if (res.ok) {
          const data = await res.json();
          sha = data.sha;
        }
      } catch {}

      await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/${relPath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message, content: base64, sha }),
        }
      );
    } catch (e) {
      console.error(`Failed to commit ${relPath}:`, e);
    }
  }
}

function triggerSummaryExtraction(ticker: string, quarter: string): void {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const scriptPath = path.join(process.cwd(), "scripts", "extract_ai_summary.py");
  execAsync(`python3 "${scriptPath}" "${ticker}" "${quarter}"`, {
    cwd: process.cwd(),
    env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
    timeout: 120_000,
  })
    .then(() => console.log(`AI summary extracted for ${ticker} ${quarter}`))
    .catch((e) => console.error(`AI summary extraction failed for ${ticker} ${quarter}:`, e));
}
