// supabase/functions/send-reminders/index.ts
//
// Deploy with:
//   supabase functions deploy send-reminders
//
// Set secrets once:
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
//
// This function is meant to be called once per hour by pg_cron (see
// cron_schedule.sql). It checks, for every business, whether it is
// currently ~6pm in that business's own time_zone, and if so, sends push
// notifications for any recurring_reminders due that day. Running hourly
// (rather than trying to schedule per-timezone) keeps this simple while
// still respecting each business's local time.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:owner@example.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!
);

function isSixPmIn(timeZone: string, now: Date) {
    try {
        const hour = new Intl.DateTimeFormat("en-US", {
            timeZone,
            hour: "numeric",
            hour12: false,
        }).format(now);
        // "24" shows up for midnight in some environments — normalize it.
        return Number(hour) % 24 === 18;
    } catch {
        // Unknown/invalid timezone string — skip rather than guess.
        return false;
    }
}

function localDateStringIn(timeZone: string, now: Date) {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now); // yyyy-mm-dd
}

function isDue(reminder: any, localDate: Date) {
    const dayOfWeek = localDate.getDay(); // 0 = Sun
    const dayOfMonth = localDate.getDate();
    const month = localDate.getMonth() + 1;

    switch (reminder.frequency) {
        case "daily":
            return true;
        case "weekly":
            return reminder.due_day === dayOfWeek;
        case "monthly":
            return reminder.due_day === dayOfMonth;
        case "yearly":
            return reminder.due_day === dayOfMonth && reminder.due_month === month;
        default:
            return false;
    }
}

Deno.serve(async (_req) => {
    const now = new Date();

    const { data: businesses, error: bizError } = await supabase
        .from("businesses")
        .select("id, time_zone");

    if (bizError) {
        return new Response(JSON.stringify({ error: bizError.message }), { status: 500 });
    }

    const dueBusinessIds: string[] = [];
    const localDateByBusiness: Record<string, string> = {};

    for (const biz of businesses ?? []) {
        if (isSixPmIn(biz.time_zone, now)) {
            dueBusinessIds.push(biz.id);
            localDateByBusiness[biz.id] = localDateStringIn(biz.time_zone, now);
        }
    }

    if (dueBusinessIds.length === 0) {
        return new Response(JSON.stringify({ sent: 0, reason: "no business at 6pm right now" }), { status: 200 });
    }

    const { data: reminders, error: remError } = await supabase
        .from("recurring_reminders")
        .select("*")
        .eq("is_active", true)
        .in("business_id", dueBusinessIds);

    if (remError) {
        return new Response(JSON.stringify({ error: remError.message }), { status: 500 });
    }

    let sentCount = 0;

    for (const reminder of reminders ?? []) {
        const todayStr = localDateByBusiness[reminder.business_id];
        if (reminder.last_triggered_on === todayStr) continue; // already sent today

        // Local calendar date for this business, used to evaluate frequency.
        const localDate = new Date(todayStr + "T00:00:00");
        if (!isDue(reminder, localDate)) continue;

        const { data: subs } = await supabase
            .from("push_subscriptions")
            .select("*")
            .eq("business_id", reminder.business_id);

        const payload = JSON.stringify({
            title: `Payment reminder: ${reminder.label}`,
            body: `${reminder.label} — UGX ${Number(reminder.amount).toLocaleString()} due today`,
            reminderId: reminder.id,
        });

        for (const sub of subs ?? []) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                );
                sentCount++;
            } catch (err: any) {
                // 404/410 = the subscription is dead (browser data cleared, etc) — clean it up.
                if (err?.statusCode === 404 || err?.statusCode === 410) {
                    await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                }
            }
        }

        await supabase
            .from("recurring_reminders")
            .update({ last_triggered_on: todayStr })
            .eq("id", reminder.id);
    }

    return new Response(JSON.stringify({ sent: sentCount }), { status: 200 });
});