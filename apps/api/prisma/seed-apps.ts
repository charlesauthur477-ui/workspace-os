import { PrismaClient, OpenMode } from "@prisma/client";

const prisma = new PrismaClient();

// Seeds the initial App Definitions + workspace-shared App Instances from
// the Workspace OS app catalog. This is purely data — the dashboard, app
// tiles, and launch logic never change when apps are added here. Re-running
// this script is safe (upsert by slug).
//
// Apps whose real URL isn't known yet (internal/custom tools) are seeded
// with an empty config.url — the Owner should edit the instance's config
// via `PATCH /apps/instances/:id` (or the admin UI once built) to fill in
// the real address once that service exists.

interface AppSeed {
  slug: string;
  name: string;
  category: string;
  icon: string; // lucide-react icon name, falls back to AppWindow if unknown
  description: string;
  openMode: OpenMode;
  url?: string; // omitted/empty => desktop app or "URL not yet configured"
}

const apps: AppSeed[] = [
  // AI Agent
  { slug: "bland-ai-agent", name: "Bland AI", category: "AI Agent", icon: "Bot", description: "AI phone agent platform.", openMode: "new_tab", url: "https://app.bland.ai" },
  { slug: "vapi-agent", name: "Vapi", category: "AI Agent", icon: "AudioLines", description: "Voice AI agent platform.", openMode: "new_tab", url: "https://dashboard.vapi.ai" },
  { slug: "zoiper", name: "Zoiper", category: "AI Agent", icon: "Phone", description: "SIP softphone desktop app.", openMode: "desktop_launch" },

  // Communication
  { slug: "whatsapp", name: "WhatsApp", category: "Communication", icon: "MessageCircle", description: "WhatsApp Web.", openMode: "new_tab", url: "https://web.whatsapp.com" },
  { slug: "telegram", name: "Telegram", category: "Communication", icon: "Send", description: "Telegram Web.", openMode: "new_tab", url: "https://web.telegram.org/a/" },
  { slug: "discord", name: "Discord", category: "Communication", icon: "MessageSquare", description: "Discord Web.", openMode: "new_tab", url: "https://discord.com/app" },

  // Email
  { slug: "gmail", name: "Gmail", category: "Email", icon: "Mail", description: "Gmail inbox.", openMode: "new_tab", url: "https://mail.google.com/mail/u/0/" },
  { slug: "outlook", name: "Outlook", category: "Email", icon: "Inbox", description: "Outlook Web.", openMode: "new_tab", url: "https://outlook.live.com/mail/" },
  { slug: "proton-mail", name: "Proton Mail", category: "Email", icon: "ShieldCheck", description: "Proton Mail.", openMode: "new_tab", url: "https://mail.proton.me" },
  { slug: "mailbux", name: "MailBux", category: "Email", icon: "Mailbox", description: "MailBux mailbox service.", openMode: "new_tab" },

  // Browser Profiles
  { slug: "anty-browser", name: "Anty Browser", category: "Browser Profiles", icon: "Fingerprint", description: "Anti-detect browser profiles.", openMode: "desktop_launch" },
  { slug: "adspower", name: "AdsPower", category: "Browser Profiles", icon: "Chrome", description: "Anti-detect browser profiles.", openMode: "desktop_launch" },
  { slug: "tor-browser", name: "Tor Browser", category: "Browser Profiles", icon: "Shield", description: "Tor Browser.", openMode: "desktop_launch" },

  // AI
  { slug: "openai", name: "OpenAI", category: "AI", icon: "Sparkles", description: "ChatGPT / OpenAI.", openMode: "new_tab", url: "https://chat.openai.com" },
  { slug: "claude", name: "Claude", category: "AI", icon: "BrainCircuit", description: "Claude by Anthropic.", openMode: "new_tab", url: "https://claude.ai" },
  { slug: "notrack-ai", name: "Notrack.ai", category: "AI", icon: "EyeOff", description: "Notrack.ai.", openMode: "new_tab" },
  { slug: "uncensored-ai", name: "Uncensored AI", category: "AI", icon: "Unlock", description: "Uncensored AI tool.", openMode: "new_tab" },

  // Numbers
  { slug: "smspva", name: "SMSPVA", category: "Numbers", icon: "MessageSquareText", description: "SMS verification numbers.", openMode: "new_tab", url: "https://smspva.com" },
  { slug: "phone-validator", name: "Phone Number Validator", category: "Numbers", icon: "PhoneCall", description: "Phone number validation tool.", openMode: "new_tab" },
  { slug: "mailsender-smtp", name: "MailSender (SMTP)", category: "Numbers", icon: "Send", description: "SMTP mail sender tool.", openMode: "new_tab" },

  // My Servers
  { slug: "phone-lookup-server", name: "Phone Lookup Server", category: "My Servers", icon: "Search", description: "Internal phone lookup service.", openMode: "new_tab" },
  { slug: "smtp-server", name: "SMTP Server", category: "My Servers", icon: "Server", description: "Internal SMTP server.", openMode: "new_tab" },
];

async function main() {
  for (const a of apps) {
    const category = await prisma.category.findUnique({ where: { name: a.category } });
    if (!category) {
      console.warn(`Skipping "${a.name}": category "${a.category}" not found. Run the base seed first.`);
      continue;
    }

    const def = await prisma.appDefinition.upsert({
      where: { slug: a.slug },
      update: {
        name: a.name,
        categoryId: category.id,
        icon: a.icon,
        description: a.description,
        openMode: a.openMode,
        isActive: true,
      },
      create: {
        slug: a.slug,
        name: a.name,
        categoryId: category.id,
        icon: a.icon,
        description: a.description,
        openMode: a.openMode,
      },
    });

    // One workspace-shared instance per app so it's visible to every active
    // user immediately (visibilityScope "workspace", ownerUserId null).
    const existing = await prisma.appInstance.findFirst({
      where: { appDefinitionId: def.id, ownerUserId: null, visibilityScope: "workspace" },
    });

    if (existing) {
      await prisma.appInstance.update({
        where: { id: existing.id },
        data: { displayName: a.name, config: { url: a.url ?? "" } },
      });
    } else {
      await prisma.appInstance.create({
        data: {
          appDefinitionId: def.id,
          ownerUserId: null,
          displayName: a.name,
          config: { url: a.url ?? "" },
          visibilityScope: "workspace",
          status: "active",
        },
      });
    }

    console.log(`✔ ${a.category} / ${a.name}${a.url ? "" : "  (no URL set yet — configure later)"}`);
  }

  console.log("\nApp catalog seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
