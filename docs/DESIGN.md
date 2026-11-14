# DESIGN.md — Bansa Frontend Design System

Read before every frontend task (`F-xxx`). It defines how Bansa looks, reads and behaves so every screen is consistent.

**Rules for the agent**
1. Use only the tokens, components and patterns in this file. Do not invent colors, fonts, radii, shadows or copy styles.
2. If a screen needs something not defined here, **stop and ask** (see `AGENT.md`). Do not improvise a new style.
3. Items marked **(DS-xxx)** are pending decisions listed in section 20. Ask before building on them.
4. A frontend task is not done until it passes the design checklist in section 19.

---

## 1. Research summary and what it changed

| Finding | Source type | Decision in Bansa |
|---|---|---|
| Kitchen screens are read from a distance, in heat and rush, with busy hands. Dark, high-contrast layouts, large item text, color-coded timing and a big "bump" control are the norm. | KDS design guides, Toast KDS docs | Kitchen board is dark, with 56px+ controls, age-based timer states (section 13.5) |
| Color coding should read quickly and across language barriers | Restaurant display guides | Status is always **color + icon + text label**, never color alone |
| QR ordering works best as a mobile web page: no app, no login, sticky cart, large touch targets, fast loading with compressed images, session reconnection | QR ordering guides and docs | Guest menu spec (section 13.1); image rules (section 9) |
| QR codes should be high contrast, preferably SVG, with error correction, and print with a short URL fallback | Adobe Express QR guide | QR table tent spec (section 13.9) |
| WCAG 2.2 AA requires 24×24 CSS px targets; AAA recommends 44×44; Material suggests 48 | WCAG, Apple, Google | Our floor is **44px** on touch screens, 48 to 64px for primary actions |
| Hind is a UI-oriented humanist sans covering Latin and Devanagari; Noto Sans Devanagari also includes Latin | Google Fonts, Figma Fonts | Restaurants may type menu names in Nepali; one family covers both scripts (section 7) |
| shadcn/ui on Tailwind v4 themes through CSS variables in OKLCH, published with `@theme inline`, with `.dark` overrides and custom semantic colors defined for both modes | shadcn and Tailwind docs | Token block in section 18 |
| eSewa's official logo guidelines allow only its own marks: off-black `#111111`, eSewa green `#3CC850`, white; logos must not be recolored or resized | eSewa Logo Guidelines PDF | Payment button rules (section 11.6) |
| Nepal VAT invoices need seller PAN/VAT number, sequential invoice number and dates; both BS and AD dates are recommended; IRD rules on certified billing software exist | IRD procedure summaries, VAT guides | Bill and invoice layout (section 13.10) and DS-008, PD-021 |

References are listed in section 21.

---

## 2. Design principles

1. **Built for the job, not the screenshot.** Every screen has one primary job (confirm an order, bump a ticket, find a dish). Everything else stays quiet.
2. **Legible at arm's length and at a glance.** Waiters hurry. Kitchens are far from the screen. Guests are in dim restaurants on small phones. Size, contrast and spacing come first.
3. **One memorable thing.** The signature is the **plate**: tables are round plate tiles (section 11.7). Everything around it is restrained.
4. **Same words, same shapes, same places.** An order status has one name, one color and one icon in every role's screen.
5. **Honest and calm.** No fake urgency, no decoration, no marketing voice inside the product. Errors say what happened and what to do.
6. **Fast on a weak connection.** Light pages, optimized images, skeletons instead of spinners.
7. **Permission-aware, never permission-trusting.** The UI hides what a role cannot do; the backend still enforces it.

### What Bansa deliberately avoids

- Cream backgrounds with terracotta accents and a high-contrast serif display
- Purple or blue gradients, glassmorphism, blurred blobs, decorative 3D shapes
- Content chopped into identical rounded cards with the same soft shadow
- One radius on everything; shadows on every card; hover lift on every card
- Fade-and-slide-up entrances on every section
- All-caps tracked labels above every heading; "01 / 02 / 03" markers on content that is not a sequence
- Emoji as icons; stock "happy diners" illustrations
- Vague copy ("Unlock the power of…"), "Submit" buttons, apologetic errors

---

## 3. Voice and personality

Plain, warm, practical. Sentence case everywhere. Short verbs. English UI in v1 (D-031). Write the way a good floor manager talks: clear, kind, no fuss.

| Do | Don't |
|---|---|
| "Confirm order" | "Submit" |
| "Order confirmed" (toast after Confirm order) | "Success!" |
| "Couldn't confirm the order. Chicken momo is out of stock. Update stock or reject the order." | "Oops! Something went wrong." |
| "No active orders. New orders appear here once a waiter confirms them." | "Nothing to see here." |

---

## 4. Users and devices

| Role | Typical device | Setting | Design consequence |
|---|---|---|---|
| Guest | Phone, 360 to 430px wide, mobile data | Dim restaurant, one hand | Mobile first, 48px targets, light page, sticky order bar |
| Waiter | Phone or small tablet, portrait or landscape | Walking, interrupted | Big plates, one-tap confirm, minimal navigation |
| Kitchen | 10 to 13 inch tablet or wall monitor, landscape | Heat, noise, gloves or wet hands, viewed from distance | Dark theme, huge type, huge targets, no hover reliance |
| Manager | Laptop or tablet | Office or floor | Dense tables allowed, keyboard friendly |
| Owner | Laptop, sometimes phone | Reviewing | Overview first, outlet switcher |
| Super Admin | Laptop | Operations | Dense data tables |

Breakpoints (Tailwind defaults): `sm 640`, `md 768`, `lg 1024`, `xl 1280`. Design mobile first. Guest and waiter screens are tested at 360px wide. The kitchen board is tested at 1280×800 and 1920×1080.

---

## 5. Visual direction

- **Surfaces:** cool, slightly blue-grey neutrals (clean stainless-steel feel) instead of warm cream. Food photos supply the warmth and color.
- **Brand color:** one deep teal ("Hearth teal"). It is used for primary actions, links, focus and selection, and sparingly elsewhere. It sits away from the status hues (plum, blue, amber, green, red) so it never reads as a status. (DS-001)
- **Structure comes from borders and spacing**, not shadows. Shadows appear only on floating layers (menus, dialogs, bottom sheets, the guest order bar).
- **Shape language:** round plates for tables, 8px controls, 12px content containers, 20px sheets. Radius follows hierarchy (section 8).
- **Not everything is a card.** Use plain sections, dividers and tables. A card needs a reason: it is an object the user acts on (an order ticket, a menu item, a table plate).

---

## 6. Color

Tokens are semantic. Components use token names, never raw hex. Values are in the CSS block in section 18. Contrast was checked against WCAG 2.2: normal text needs 4.5:1, UI boundaries 3:1.

### 6.1 Core neutrals and brand (light)

| Token | Hex | Use | Contrast note |
|---|---|---|---|
| `background` | `#F6F7F8` | App background | |
| `card` / `popover` | `#FFFFFF` | Raised content, inputs, tables | |
| `foreground` | `#17212B` | Body text and headings | 15.2:1 on background |
| `muted-foreground` | `#5B6770` | Secondary text | 5.4:1 on background |
| `border` | `#DDE2E6` | Dividers and card borders (decorative) | Not for input edges |
| `input` | `#7D8993` | Form control borders | 3.3:1 on background, 3.6:1 on white |
| `primary` | `#0B5D66` | Primary buttons, links, focus ring | 7.6:1 with white text |
| `primary-foreground` | `#FFFFFF` | Text on primary | |
| `accent` | `#E3F1F2` | Selected nav item, hovered row, light brand tint | 8.6:1 with `accent-foreground` `#0B4A52` |
| `secondary` | `#E9EEF0` | Secondary buttons, subtle fills | |
| `destructive` | `#B42318` | Delete, reject, cancel | 6.6:1 on white |
| `ring` | `#0B5D66` | Focus ring | |

### 6.2 Order status (the same in every role's screen)

| Status | Label | Icon (lucide) | Text | Fill | Contrast |
|---|---|---|---|---|---|
| `pending_confirmation` | Awaiting confirmation | `hand` | `#6B2F8A` | `#F1E7F7` | 7.3:1 |
| `placed` | New | `circle-dot` | `#1D5FA8` | `#E4EEF9` | 5.5:1 |
| `preparing` | Preparing | `flame` | `#9A4B00` | `#FCEBD3` | 5.3:1 |
| `ready` | Ready | `bell-ring` | `#17683A` | `#DDF1E4` | 5.8:1 |
| `served` | Served | `utensils` | `#4A5560` | `#E9EDF0` | 6.5:1 |
| `completed` | Completed | `check-check` | `#4A5560` | `#E9EDF0` | 6.5:1 |
| `cancelled` | Cancelled | `circle-x` | `#A4231A` | `#FBE4E1` | 6.1:1 |

Rules:
- A status badge always shows **icon + label**. Color is reinforcement.
- Status colors are reserved. Never reuse them for decoration or brand.
- "Late" (timer overdue) uses the cancelled/red treatment plus the word "Late".
- Table states (free, occupied, needs bill) have their own treatment in section 11.7 and do not reuse order status labels.

### 6.3 Kitchen and dark theme

The kitchen board always uses the dark set. The dashboard can also run dark (DS-004).

| Token | Hex | Contrast |
|---|---|---|
| `kds-background` | `#0E151B` | |
| `kds-surface` (ticket) | `#17212A` | |
| `kds-border` | `#2B3844` | |
| `kds-foreground` | `#F1F4F6` | 14.8:1 on surface |
| `kds-muted` | `#9AA7B2` | 6.6:1 on surface |
| Status on dark: awaiting `#C9A0E6`, new `#7DB4F2`, preparing `#F5B14C`, ready `#5ACB8A`, late `#FF7A6E` | | 6.4 to 8.8:1 on surface |

### 6.4 Payment brand

- eSewa payment button: background `#3CC850`, text and logo `#111111` (8.6:1). **White text on this green fails (2.2:1); never use it.**
- Use only the official eSewa logo asset. Do not recolor or resize its internal elements. (eSewa logo guidelines.)

### 6.5 Charts

- A single series uses `primary`.
- Multiple series use this colorblind-safe set, in order: `#0B5D66`, `#E69F00`, `#0072B2`, `#CC79A7`, `#009E73`. Maximum five series.
- Label lines and bars directly where possible. Never use color alone to distinguish series (add markers or direct labels). No gradients, no 3D.

---

## 7. Typography

| Role | Family | Weights | Used for |
|---|---|---|---|
| **UI and text** | **Hind** (Latin + Devanagari) | 400, 500, 600, 700 | All interface text, menu item names, forms, tables |
| **Display and figures** | **Barlow Semi Condensed** (Latin) | 600, 700 | Wordmark, landing headlines, table labels, order numbers, kitchen ticket headers, large key figures |

Why: Hind is built for UI and covers both English and Nepali script, so menu items typed in Devanagari render in the same family as the surrounding English. Barlow Semi Condensed has a signage and docket character that suits order numbers and table labels and stays compact on tickets. The pair is clearly distinct. Final approval after a specimen check (DS-002, DS-003).

Fallback stack: `"Hind", "Noto Sans Devanagari", system-ui, sans-serif` and `"Barlow Semi Condensed", "Hind", system-ui, sans-serif`. Load with `next/font` with subsets `latin` and `devanagari` for Hind, and `display: swap`.

### Type scale (px, dashboard and guest)

| Style | Size / line height | Weight | Use |
|---|---|---|---|
| Display | 48 / 52 | Barlow 700 | Landing hero only |
| Page title (h1) | 28 / 36 | Hind 600 | Page headings |
| Section title (h2) | 22 / 30 | Hind 600 | Section headings |
| Subsection (h3) | 18 / 26 | Hind 600 | Card and panel titles |
| Body | 16 / 26 | Hind 400 | Default text, guest menu text |
| Dense UI | 14 / 20 | Hind 400/500 | Tables, form helper text, dashboard controls |
| Caption | 12 / 16 | Hind 500 | Timestamps, units. Never for essential info |

### Kitchen and waiter scale (touch and distance)

| Style | Size | Weight |
|---|---|---|
| Table label on ticket | 44 px | Barlow 700 |
| Item line ("2 × Chicken momo") | 24 to 28 px | Hind 600 |
| Modifier or note | 20 px | Hind 500 |
| Timer | 24 px | Barlow 600 |
| Button label | 20 px | Hind 600 |

### Rules

- Line length under about 75 characters for text blocks.
- **Devanagari needs more vertical room.** Use line height 1.6 or more where Devanagari can appear (menu item names and descriptions); do not clip with fixed heights or tight `line-clamp` without testing both scripts.
- Numbers in tables and money use tabular figures (`font-variant-numeric: tabular-nums`). If Hind lacks them, use Barlow for numeric columns (DS-003).
- Sentence case. No all-caps labels, no letter-spaced eyebrows. No underlined text except links.
- Never accent a single word in a headline with a different color or style.
- Minimum body text on guest screens is 16px (prevents iOS zoom on inputs).

---

## 8. Spacing, layout, shape

**Spacing:** 4px base. Allowed steps: 4, 8, 12, 16, 24, 32, 48, 64. Page padding: 16 (mobile), 24 (tablet), 32 (desktop).

**Layout widths**

| Context | Max width |
|---|---|
| Guest pages | 480px, centered on larger screens |
| Forms and settings | 560px |
| Dashboard content | 1280px |
| Public marketing pages | 1120px |

**Radius (by hierarchy, not one size):**

| Element | Radius |
|---|---|
| Badges, chips | 999px (pill) |
| Buttons, inputs, selects | 8px |
| Content containers, menu item rows, ticket cards | 12px |
| Bottom sheets, dialogs | 20px (top corners for sheets) |
| Table plates | Full circle |
| Data tables | 12px outer, square internal rows |

**Elevation:** borders first. Shadow only on layers that float: popovers/menus, dialogs, bottom sheets, the guest sticky order bar. One shadow recipe for floating layers: `0 8px 24px oklch(0.24 0.024 249 / 0.14)`. No shadow on ordinary cards.

**Density:** two modes.
- **Comfortable (default):** 44px controls and rows. Guest, waiter, kitchen, forms.
- **Compact:** 36px rows for manager and admin data tables on desktop only. Row actions must keep at least 24px of spacing between targets (WCAG 2.5.8).

---

## 9. Icons and imagery

- **Icons:** `lucide-react` only (shadcn default). 20px default, 24px in nav and primary buttons, 1.75 stroke. Icons accompany text; icon-only buttons need an `aria-label` and a tooltip.
- **Food photos:** supplied by restaurants. Display in a consistent 4:3 crop with `object-fit: cover`. Serve through Cloudinary transformations for auto format and quality and responsive widths (about 160px thumbnails in lists, 640px in detail). Always set width and height and a low-quality placeholder so layout does not jump.
- **No photo available:** show a plain tinted tile with the item's first letter in the display font, not a clip-art plate.
- **No stock illustrations, no 3D shapes, no gradient decoration.**
- **Logo and mark:** interim wordmark "Bansa" in Barlow Semi Condensed 700. A plate-ring mark (a circle with a small break) is proposed. Final logo to be provided by the owner (DS-010).

---

## 10. Motion

Motion explains a change or draws attention to something new. It is otherwise absent.

| Use | Behavior |
|---|---|
| Button, toggle, checkbox | 120ms color/transform feedback |
| Dialog, sheet, popover open/close | 160 to 200ms ease-out, no bounce |
| New order arrives (waiter, kitchen) | The new ticket or row highlights once for about 1.5s and the count badge updates. Optional sound (DS-012) |
| Status changes | The badge swaps and the item moves to its column with a 160ms transition |
| Landing page | One scripted demo sequence plays once (section 13.11). No scroll-triggered fade-ups |

Rules: respect `prefers-reduced-motion` (replace movement with instant change and a brief highlight). No looping animations. No hover lift on cards. No parallax. Skeletons shimmer very subtly or not at all.

---

## 11. Components

Build on shadcn/ui primitives, themed with the tokens. Custom components live in `components/shared` or in their feature's `views/` folder (see `CODING_STANDARDS.md`).

### 11.1 Buttons

| Variant | Use | Style |
|---|---|---|
| Primary | The one main action on a screen | `primary` fill, white text |
| Secondary | Supporting actions | `secondary` fill, `foreground` text |
| Outline | Neutral alternatives | `input` border, transparent |
| Ghost | Toolbar, low emphasis | no border or fill, accent on hover |
| Destructive | Delete, reject, cancel order | `destructive` fill, white text |

Sizes: Default 44px high (touch UIs) and 36px (compact desktop tables only). Large 56px for kitchen and waiter primary actions, 64px for the kitchen bump button. Labels are verbs (section 14). One primary button per view region. Disabled buttons explain why through helper text or tooltip. A loading button shows a spinner and keeps its width.

### 11.2 Inputs and forms

- 44px high, 8px radius, `input` border, 16px text. Visible label above the field (never placeholder-only).
- Helper text below in muted 14px; error text below in `destructive` with an icon, linked with `aria-describedby`.
- Validate on blur and on submit with the Zod schema; show the first error per field.
- Single column forms, max 560px. Group related fields with a section title. Mark optional fields "(optional)"; do not mark required ones with asterisks.
- Money inputs show the "Rs" prefix, use numeric keyboard, accept two decimals.
- Submit button text says what it does ("Save menu item"), not "Submit".

### 11.3 Status badge

Pill, 24px high, icon (14px) + label (12/14px, 600), colors from 6.2. Used in tables, tickets and guest tracking. One component, `OrderStatusBadge`, used everywhere.

### 11.4 Data tables

- Toolbar above: search, filter chips, primary action at the right.
- Sticky header, 1px bottom border on rows, no zebra. Hover uses `accent`. Selected uses `accent` with a left 2px `primary` bar.
- Numeric columns right aligned, tabular figures. Money has "Rs" prefix.
- Row actions in a trailing `⋯` menu with 44px target (36px compact). Destructive actions need a confirm dialog.
- Pagination at the bottom with page size. Empty and loading states per 12.3.
- Below `md`, a table becomes a stacked list of rows showing the two or three key fields.

### 11.5 Dialogs, sheets, toasts

- **Dialog:** centered, max 480px, title + one sentence + actions. Destructive confirm names the object: "Delete Chicken momo? Orders keep their history."
- **Bottom sheet:** guest cart, filters and item options on mobile. Drag handle, 20px top radius, closes on swipe down and outside tap.
- **Toast:** bottom center on mobile, top right on desktop; 4s; one line; same verb as the action that triggered it ("Order confirmed"). Errors persist until dismissed.
- Never use native `alert`.

### 11.6 Payment button (eSewa)

- Label: "Pay with eSewa" (plus the official logo). Background `#3CC850`, text and logo `#111111`.
- Do not alter the logo, recolor it or change its proportions. Use the asset provided by eSewa. Size the button at least as large as other payment options.
- Beside it: "Pay cash at the table" as an outline button. eSewa is not the default color-wise; they are equal in size.
- After redirect back, show a "Checking your payment" state until the backend confirms (the redirect alone is not proof; see `SECURITY.md`).

### 11.7 Table plate (signature component)

A round tile representing a table. Used in the waiter floor view, the manager's table list and the table picker.

```
   ┌ ○ ┐   plate: 88px circle (72px on small phones)
  (  T6  )  label in Barlow 700, 28px
   └ 4:20 ┘  second line: elapsed time or item count, 14px
```

| Table state | Look | Badge (top right, 20px) |
|---|---|---|
| Free | White fill, 2px `input` border | none |
| Occupied | `accent` fill, 2px `primary` border | none |
| Has orders awaiting confirmation | Occupied look + 3px plum ring | plum dot with count, `hand` icon |
| Order ready to serve | Occupied look + 3px green ring | `bell-ring` icon |
| Needs bill | Occupied look + 3px amber ring | `receipt` icon |

Rules: priority when several apply is awaiting confirmation, then needs bill, then ready. The tile is a 44px+ target; tapping opens the table's sheet. Plates sit in a grid with `repeat(auto-fill, minmax(104px, 1fr))` and 16px gaps.

### 11.8 Order ticket (kitchen and waiter)

See wireframe in 13.5. Rules: table label is the largest element, order number is secondary, age timer top right, items listed with quantity first, modifiers indented, notes in a bordered box with an icon, one full-width action at the bottom.

### 11.9 Menu item row (guest)

Photo 88×88 (12px radius) on the right or left (left in LTR), name (16px 600), one-line description (14px muted, clamp 2 lines with Devanagari-safe line height), price (16px 600) and a 44px add button. Unavailable items stay visible, are dimmed to 60%, show "Unavailable" text and cannot be added.

### 11.10 Quantity stepper

Minus, count, plus buttons, 44px each, count in the middle (tabular figures). Minus at quantity 1 becomes a remove icon. Max per line is set by the server; show a message when reached.

### 11.11 Outlet switcher

- Visible only to Owner and Manager with more than one outlet, and only when the plan has multi-outlet enabled.
- Top bar, left of the page title area: outlet name + chevron; opens a list with a search field above 6 outlets. The current outlet has a check.
- Changing outlet reloads data for that outlet and shows the name in the page title area; the choice is remembered (`last_outlet_id`).
- Waiter and Kitchen never see it; their outlet name appears as plain text.
- For single-outlet organizations the word "outlet" does not appear anywhere in the interface.

### 11.12 Navigation

- **Dashboard (Owner, Manager):** left sidebar 248px (collapses to a 72px icon rail at `lg` and below; becomes a top bar plus menu sheet at `md` and below). Items come from permissions. Active item: `accent` background, `primary` text, 3px left bar.
- **Waiter:** no sidebar. Top bar with outlet name, notification bell and menu; bottom tab bar on phones: Tables, Orders, Account.
- **Kitchen:** no sidebar. Slim top bar: outlet name, clock, sound toggle, "Stock" link, fullscreen button.
- **Super Admin:** sidebar like Owner with its own item set.
- **Guest:** header with restaurant logo/name and table label, sticky category tabs, sticky order bar.

Sidebar items (permission-gated): Overview, Orders, Menu, Tables, Inventory, Staff, Analytics, Subscription, Settings. Super Admin: Organizations, Plans, Subscriptions, Payments, Leads, Platform stats.

### 11.13 Other shared pieces

`PageHeader` (title, optional description, actions), `EmptyState`, `ErrorState`, `Skeleton*`, `ConfirmDialog`, `Money` (formatting), `DateTime` (formatting), `StatLine` (label, value, delta), `PermissionGate`, `TimerBadge`. Each is built once and reused.

---

## 12. Patterns

### 12.1 Permission-aware UI
Hide navigation and actions a role cannot use. If a user reaches a screen without access (direct URL), show a plain "You don't have access to this page" state with a link back. Never show disabled controls for actions a role can never perform.

### 12.2 Plan and subscription states
- **Trial:** a slim notice in the top bar: "Trial ends in 6 days. View plans." Links to Subscription.
- **Grace (read-only):** a persistent banner under the top bar: "Your trial has ended. Your data is read-only until you renew." Create and edit controls are disabled with a tooltip explaining why.
- **Suspended:** a full-page state with renewal steps and a contact action.
- **Limit reached:** inline message at the control: "You've reached the 10-item limit on your plan." plus "View plans".

### 12.3 Loading, empty, error
- **Loading:** skeletons that match the final layout. Spinners only inside buttons.
- **Empty:** one sentence saying what belongs here and one action. Example: "No tables yet. Add a table to generate its QR code." with the "Add table" button.
- **Error:** what happened, what to do, retry button. Example: "Couldn't load orders. Check your connection and try again."
- **Offline or socket lost:** a thin banner: "Live updates paused. Reconnecting…" and refetch on reconnect. Critical on kitchen and waiter screens.

### 12.4 Real-time updates
New items appear at the top of their list or column with a one-time highlight. The tab title shows the count of items needing action. Do not move items the user is currently interacting with.

### 12.5 Destructive and irreversible actions
Confirmation dialog that names the object and the consequence. Reject order asks for a reason. Closing a table shows the bill total first.

### 12.6 Forms across steps
Registration, outlet setup and onboarding checklist use a visible checklist (Add tables, Add menu, Invite staff, Add ingredients). This is a real sequence, so numbering is allowed there.

---

## 13. Screens

Wireframes show structure, not final visuals. Alignment: text is left aligned; numbers in tables are right aligned; guest and form pages are a single left-aligned column.

### 13.1 Guest menu (mobile)

```
┌────────────────────────────┐
│ [logo] Everest Momo House   │  header: restaurant, table label
│ Table 6                     │
├────────────────────────────┤
│ Momo  Thali  Sides  Drinks  │  sticky category tabs (scrollable)
├────────────────────────────┤
│ Momo                        │
│ ┌──────────────────────┐   │
│ │ Chicken steamed momo  [img]│  item row
│ │ 10 pieces, tomato achar    │
│ │ Rs 220              [ + ]  │
│ └──────────────────────┘   │
│ ...                         │
├────────────────────────────┤
│ 2 items   Rs 440  View order│  sticky order bar (floating layer)
└────────────────────────────┘
```

- Server rendered; shows content immediately; images lazy-load below the fold.
- Tapping an item with options opens a bottom sheet (variants as radio list, add-ons as checkboxes, notes field, quantity stepper, "Add to order" button with price).
- The order bar appears after the first item and opens the order sheet.
- If the table has an open session with orders, a "Your orders" entry appears in the header.

### 13.2 Guest order sheet and tracking

```
Your order · Table 6
──────────────────────────
2 × Chicken steamed momo          Rs 440
1 × Masala tea                     Rs 60
Notes: less spicy
──────────────────────────
Subtotal  Rs 500   (VAT and service charge shown on the bill)
[ Place order ]
```

After placing:

```
Order #14                [ Awaiting confirmation ]
A waiter will confirm your order shortly.

 ● Sent to waiter
 ○ Confirmed
 ○ Preparing
 ○ Ready
 ○ Served
[ Add more items ]   [ Request bill ]
```

This is a real sequence, so the step list is appropriate. The current step is filled and labeled; completed steps show a check. Rejected orders show the waiter's reason and "Order again". The page keeps working after the phone sleeps (reconnect, refetch).

### 13.3 Guest bill and payment

```
Bill · Table 6
Items ........................ Rs 500
Service charge (10%) ......... Rs 50
VAT (13%) .................... Rs 71.50
──────────────────────────────
Total                         Rs 621.50
[ Pay with eSewa ]   (official green button)
[ Pay cash at the table ]
```

After eSewa redirect back: "Checking your payment…" then "Payment received. Thank you." or "Payment not confirmed. Try again or pay at the table."

### 13.4 Waiter floor

Phone portrait:

```
┌─────────────────────────────┐
│ Everest Momo House      🔔3 │
├─────────────────────────────┤
│ Needs your attention        │
│ ┌─────────────────────────┐│
│ │ T6 · Order #14 · 2 min  ││  awaiting confirmation list
│ │ 2 items       [Reject][Confirm]││
│ └─────────────────────────┘│
├─────────────────────────────┤
│ Tables                      │
│  (T1) (T2) (T3) (T4)        │  plates
│  (T5) (T6) (T7) (T8)        │
├─────────────────────────────┤
│  Tables      Orders   Account│  bottom tabs
└─────────────────────────────┘
```

- "Needs your attention" lists awaiting-confirmation orders first, then bill requests, then ready-to-serve. It is hidden when empty.
- Tapping a plate opens a sheet: current orders by status, "Add order", "Generate bill", "Close table".
- Confirm is a single tap with a toast and undo is not offered; Reject opens a reason dialog.

### 13.5 Kitchen board (dark, landscape)

```
┌─────────────────────────────────────────────────────────────┐
│ Everest Momo House     14:32      🔔 sound   Stock   ⛶       │
├───────────────┬───────────────────┬─────────────────────────┤
│ New (3)       │ Preparing (4)     │ Ready (2)               │
│ ┌───────────┐ │ ┌───────────────┐ │ ┌─────────────────────┐ │
│ │ T6   02:10│ │ │ T2      08:45 │ │ │ T4          Ready   │ │
│ │ #14       │ │ │ #11    [flame]│ │ │ #9                   │ │
│ │ 2 × Chicken│ │ │ 1 × Buff sekuwa│ │ │ 3 × Veg momo        │ │
│ │   momo     │ │ │   no onion    │ │ │                     │ │
│ │ [Start preparing]│ │ [Mark ready]  │ │ (waiter serves)     │ │
│ └───────────┘ │ └───────────────┘ │ └─────────────────────┘ │
└───────────────┴───────────────────┴─────────────────────────┘
```

- Column order follows the work: New, Preparing, Ready. Each column header shows a count.
- Ticket age states (thresholds configurable, defaults pending DS-013): normal; amber 2px border and amber timer after the first threshold; red border, red timer and the word "Late" after the second.
- Item notes and changes sit in a bordered box with an icon and text prefix ("Note:", "No", "Extra"); never colored text alone.
- Buttons are 64px high, full ticket width. Tap targets never rely on hover. Newest tickets appear at the top of their column.
- A "Mark unavailable" action is on each item line (kitchen permission `item.mark_unavailable`), with a confirm.
- If the item is out of stock after confirmation, the kitchen cancels the item and the waiter is notified (PD-010).
- Optional sound on new order, toggled in the top bar (DS-012).

### 13.6 Owner overview

```
Overview · Everest Momo House       [Today ▾]   (outlet switcher left)
────────────────────────────────────────────────────────────────
Revenue Rs 48,250    Orders 62    Average order Rs 778    Open tables 5
────────────────────────────────────────────────────────────────
Revenue by hour (line chart)                   Low stock
                                               Chicken mince    1.2 kg
                                               Momo wrappers    40 pcs
Top items                                      Mustard oil      2 L
1  Chicken steamed momo   64 sold   Rs 14,080
2  Masala tea             51 sold   Rs 3,060
...                                            Needs attention
                                               2 orders awaiting confirmation
```

- Key figures sit in one plain row separated by whitespace, not as four gradient cards.
- Charts use section 6.5 colors, have a visible title, axis labels in 12px, and a table view toggle for accessibility.
- The consolidated Owner view adds an outlet column and a stacked bar by outlet, plus an outlet filter.

### 13.7 Menu manager

Table of items (photo, name, category, price, availability toggle, actions). Row click opens an edit sheet on desktop and a full page on mobile. The edit form: name, description, category, price, image upload, veg flag, prep time, options, recipe tab (ingredients and quantities). For multi-outlet, an "Outlet prices" tab lists outlets with override price and availability. A manager sees the outlet tab for assigned outlets only (PD-018).

### 13.8 Inventory

Tabs: Stock, Ingredients, Movements. Stock table: ingredient, on hand (with unit), low threshold, status ("Low" badge in amber text + icon), actions (Restock, Adjust, Log wastage). Low rows sort first. Kitchen sees Stock with Adjust and Log wastage only. Movements table lists who, what, how much, reason, time, with a filter by type.

### 13.9 Tables and QR

Table list as plates plus a table view. "Print QR codes" opens a print layout with one table tent per table.

QR table tent (A5 or A6, portrait):

```
┌──────────────────┐
│ Everest Momo House │
│                    │
│   ┌────────────┐   │
│   │  QR (SVG)  │   │  black on white, error correction M or higher
│   └────────────┘   │
│  Scan to order     │
│                    │
│       T6           │  table label large (Barlow)
│  bansa.app/m/xxxx  │  short URL fallback
│  Powered by Bansa  │  small (DS-006)
└──────────────────┘
```

Rules: pure black on white for the QR, quiet zone respected, minimum printed QR size about 3 cm, test scan from 40 cm before printing.

### 13.10 Bill and invoice (print and screen)

- Receipt layout for **80mm thermal** width, with an A4 variant (DS-009). Monospace is not required; use Hind at 12 to 14px.
- Contents: restaurant name, address, phone, **PAN/VAT number**, bill number (sequential per outlet), **date in AD and BS**, table, item lines (qty, name, rate, amount), subtotal, service charge, discount, VAT (13%) shown separately, total, payment method, "Thank you".
- Title: "Bill" in v1 unless the compliance decision says otherwise (PD-021). Do not label a document "Tax invoice" or imply IRD certification until that decision is made.
- The bill number must be sequential and never reused. Cancelled bills keep their number and show "Cancelled".

### 13.11 Landing page (public, SSR, SEO)

Job: let a restaurant owner understand what Bansa does and start a trial.

- **Hero:** left, a plain headline, one supporting sentence and the "Start free trial" primary button plus "Talk to us" secondary. Right, a **live demo**: a phone showing the guest menu next to a kitchen ticket. One scripted loop plays once on load (guest adds a dish, order awaits confirmation, waiter confirms, ticket appears on the kitchen board, status turns Ready) and then rests on the final frame. This shows the product's real core flow instead of a stats-and-gradient hero.
- **How it works:** four steps, because it is a real sequence: guest scans, waiter confirms, kitchen cooks, guest pays by eSewa or cash.
- **For owners and managers:** stock that updates itself, many outlets in one place, reports. Short text with real screenshots of the dashboard. No icon grid of generic benefits.
- **Pricing:** three plans in a comparison table (Trial, Single Outlet, Custom). Prices appear only once decided.
- **FAQ** and **footer** with contact. Meta tags, Open Graph image and structured headings for SEO.

Draft headline (owner to approve): "Your tables order. Your kitchen sees it at once."
Support: "Guests scan a QR code at the table. A waiter confirms. The kitchen cooks. Stock updates itself."

### 13.12 Auth pages

Single centered column, 400px: wordmark, title, form, link to the alternate action. No split-screen marketing panel. Register has fields: restaurant name, your name, email, password. Verify-email page shows a plain "Check your email" state with "Resend email" (rate limited message when blocked).

### 13.13 Subscription and Super Admin

- **Subscription (Owner):** current plan, status, period end, usage versus limits as simple labeled bars (outlets, staff, menu items), renewal steps for manual payment, reference form, history table, "Request a custom plan" form.
- **Super Admin:** organizations table (status badge, plan, outlets, trial end), row sheet with overrides and trial extension, payment approvals queue, leads table, plan editor, platform stats row. Dense compact tables are allowed here.

---

## 14. Content and microcopy

### 14.1 Vocabulary (one name per concept, everywhere)

| Concept | Use | Never |
|---|---|---|
| Restaurant business | Organization (settings only), otherwise the restaurant name | Tenant, account |
| Location | Outlet (only when the org has several; otherwise nothing) | Branch, store, shop |
| Table session | Table (the guest and staff say "Table 6") | Session |
| Guest order awaiting a waiter | Awaiting confirmation | Pending approval, unconfirmed |
| Guest | Guest | Customer, user |
| Ingredient stock | Stock | Inventory count (except the nav label "Inventory") |
| Loss of ingredients | Wastage | Waste, spoilage |

### 14.2 Action names (the same verb in the button, the toast and the log)

| Action | Button | Toast |
|---|---|---|
| Waiter confirms guest order | Confirm order | Order confirmed |
| Waiter rejects guest order | Reject order | Order rejected |
| Kitchen begins | Start preparing | Preparing started |
| Kitchen finishes | Mark ready | Marked ready |
| Waiter delivers | Mark served | Marked served |
| Guest asks for bill | Request bill | Bill requested |
| Staff records cash | Record cash payment | Payment recorded |
| Staff closes table | Close table | Table closed |
| Add stock | Add stock | Stock added |
| Correct stock count | Adjust stock | Stock adjusted |
| Log loss | Log wastage | Wastage logged |
| Save a form | Save changes (or "Save menu item") | Changes saved |

### 14.3 Error format
`<What happened>. <What to do>.` Examples:
- "Couldn't place the order. Chicken momo just ran out. Remove it or choose another dish."
- "Couldn't save the menu item. The price must be 0 or more."
- "You've reached the 10-item limit on your plan. View plans to add more."
- Network: "No connection. We'll keep trying."

Errors do not apologize and do not blame the user.

### 14.4 Empty states
One sentence plus one action. Written in section 12.3.

---

## 15. Localization and formats

- **Language:** English UI in v1. Menu item names and descriptions may contain Nepali (Devanagari); the UI must render them correctly (DS-011).
- **Currency:** "Rs" prefix by default (NPR). Nepali convention groups digits in lakh and crore style (for example `Rs 1,25,000`); format with `Intl.NumberFormat("en-IN")` and a "Rs" prefix, verifying the output in tests (DS-007). Always two decimals on bills, none on whole-rupee menu prices unless the price has paise.
- **Dates and time:** shown in the outlet's time zone. Dashboard uses AD dates. **Bills and invoices show both AD and BS (Bikram Sambat) dates** (DS-008). Time uses 12-hour format with am or pm for guests and staff (confirm, DS-008).
- **Numerals:** Latin digits (0 to 9) in v1.
- **Right to left:** not needed.
- **Text expansion:** components must tolerate Nepali strings that are longer and taller; avoid fixed-height text containers.

---

## 16. Accessibility checklist

- Text contrast at least 4.5:1; large text and UI boundaries at least 3:1 (tokens in section 6 already meet this; verify custom use).
- Touch targets at least 44×44 CSS px on touch screens (24×24 with spacing is the AA floor).
- Visible focus ring on every interactive element: 2px `ring` with 2px offset; never remove the outline.
- Full keyboard use on dashboard screens; logical tab order; skip link on dashboard layout.
- Status never conveyed by color alone.
- Form fields have labels; errors are announced (`aria-live="polite"`) and linked to fields.
- Dialogs trap focus and restore it on close (shadcn/Radix does this; do not break it).
- Images have meaningful `alt` text (menu item name) or empty alt when decorative.
- Respect `prefers-reduced-motion` and, for the dashboard, `prefers-color-scheme` (DS-004).
- Language attribute `lang="en"` on the page; spans with `lang="ne"` around Nepali content where known.
- Charts provide a table alternative.
- Zoom to 200% without loss of content or function.

---

## 17. Responsive rules

- Mobile first. Stack columns below `md`.
- Dashboard sidebar becomes a menu sheet below `md`; tables become stacked lists.
- The kitchen board shows three columns at 1024px and wider; below that it shows tabs for New, Preparing, Ready.
- Guest pages never scroll horizontally. The category tabs are the only horizontal scroller.
- Use `min-h-dvh`, not `100vh`, for full-height layouts on phones.
- Test: 360×740 (guest, waiter), 768×1024 (tablet), 1280×800 (kitchen), 1440×900 (dashboard).

---

## 18. Implementation

### 18.1 Tokens (Tailwind v4 + shadcn/ui, OKLCH)

Put this in `src/app/globals.css`. Keep token names; add new ones only after asking. Values were generated from the hex values in section 6.

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.976 0.002 248);
  --foreground: oklch(0.243 0.024 249);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.243 0.024 249);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.243 0.024 249);
  --primary: oklch(0.438 0.072 207);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.946 0.006 223);
  --secondary-foreground: oklch(0.243 0.024 249);
  --muted: oklch(0.956 0.004 236);
  --muted-foreground: oklch(0.507 0.021 240);
  --accent: oklch(0.948 0.015 202);
  --accent-foreground: oklch(0.376 0.060 208);
  --destructive: oklch(0.500 0.182 30);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.910 0.008 242);
  --input: oklch(0.624 0.021 243);
  --ring: oklch(0.438 0.072 207);
  --radius: 0.75rem;

  /* order status: text and fill */
  --status-awaiting: oklch(0.430 0.151 312);  --status-awaiting-bg: oklch(0.940 0.024 313);
  --status-new: oklch(0.485 0.134 254);       --status-new-bg: oklch(0.945 0.018 251);
  --status-preparing: oklch(0.503 0.127 53);  --status-preparing-bg: oklch(0.947 0.037 77);
  --status-ready: oklch(0.458 0.106 153);     --status-ready-bg: oklch(0.940 0.027 157);
  --status-neutral: oklch(0.444 0.023 248);   --status-neutral-bg: oklch(0.944 0.006 240);
  --status-cancelled: oklch(0.471 0.166 29);  --status-cancelled-bg: oklch(0.937 0.026 27);

  /* payment brand (official eSewa colors) */
  --esewa: oklch(0.734 0.200 145);
  --esewa-foreground: oklch(0.178 0 0);

  /* charts */
  --chart-1: oklch(0.438 0.072 207);
  --chart-2: oklch(0.753 0.158 77);
  --chart-3: oklch(0.532 0.131 244);
  --chart-4: oklch(0.679 0.118 346);
  --chart-5: oklch(0.620 0.130 165);

  --sidebar: oklch(1 0 0);
  --sidebar-foreground: oklch(0.243 0.024 249);
  --sidebar-primary: oklch(0.438 0.072 207);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.948 0.015 202);
  --sidebar-accent-foreground: oklch(0.376 0.060 208);
  --sidebar-border: oklch(0.910 0.008 242);
  --sidebar-ring: oklch(0.438 0.072 207);
}

.dark {
  --background: oklch(0.191 0.012 237);
  --foreground: oklch(0.965 0.004 236);
  --card: oklch(0.235 0.018 245);
  --card-foreground: oklch(0.965 0.004 236);
  --popover: oklch(0.235 0.018 245);
  --popover-foreground: oklch(0.965 0.004 236);
  --primary: oklch(0.729 0.098 205);
  --primary-foreground: oklch(0.259 0.039 206);
  --secondary: oklch(0.334 0.027 247);
  --secondary-foreground: oklch(0.965 0.004 236);
  --muted: oklch(0.285 0.02 246);
  --muted-foreground: oklch(0.722 0.022 244);
  --accent: oklch(0.31 0.03 215);
  --accent-foreground: oklch(0.92 0.03 205);
  --destructive: oklch(0.732 0.164 27);
  --destructive-foreground: oklch(0.2 0.02 27);
  --border: oklch(0.334 0.027 247);
  --input: oklch(0.55 0.025 245);
  --ring: oklch(0.729 0.098 205);

  /* status on dark: text colors; fills are 15% mixes of the text color */
  --status-awaiting: oklch(0.767 0.107 311);
  --status-new: oklch(0.756 0.107 252);
  --status-preparing: oklch(0.807 0.140 74);
  --status-ready: oklch(0.760 0.140 156);
  --status-neutral: oklch(0.722 0.022 244);
  --status-cancelled: oklch(0.732 0.164 27);

  /* kitchen board (always dark) */
  --kds-background: oklch(0.192 0.016 245);
  --kds-surface: oklch(0.242 0.022 246);
  --kds-border: oklch(0.334 0.027 247);
  --kds-foreground: oklch(0.965 0.004 236);
  --kds-muted: oklch(0.722 0.022 244);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-status-awaiting: var(--status-awaiting);
  --color-status-awaiting-bg: var(--status-awaiting-bg);
  --color-status-new: var(--status-new);
  --color-status-new-bg: var(--status-new-bg);
  --color-status-preparing: var(--status-preparing);
  --color-status-preparing-bg: var(--status-preparing-bg);
  --color-status-ready: var(--status-ready);
  --color-status-ready-bg: var(--status-ready-bg);
  --color-status-neutral: var(--status-neutral);
  --color-status-neutral-bg: var(--status-neutral-bg);
  --color-status-cancelled: var(--status-cancelled);
  --color-status-cancelled-bg: var(--status-cancelled-bg);
  --color-esewa: var(--esewa);
  --color-esewa-foreground: var(--esewa-foreground);
  --color-kds-background: var(--kds-background);
  --color-kds-surface: var(--kds-surface);
  --color-kds-border: var(--kds-border);
  --color-kds-foreground: var(--kds-foreground);
  --color-kds-muted: var(--kds-muted);
  --font-sans: var(--font-hind), "Noto Sans Devanagari", system-ui, sans-serif;
  --font-display: var(--font-barlow), var(--font-hind), system-ui, sans-serif;
  --radius-sm: 0.5rem;   /* controls */
  --radius-md: 0.75rem;  /* containers */
  --radius-lg: 1.25rem;  /* sheets and dialogs */
}
```

Notes:
- The dark values for `accent`, `muted`, `input` and the dark status fills are starting points and must be contrast-checked in the first frontend task (F-001) before use. Light values and kitchen values were already checked.
- Next.js: use `next-themes` with `attribute="class"` and `suppressHydrationWarning` on `<html>`. The kitchen route forces the dark class.
- Fonts via `next/font/google` as CSS variables `--font-hind` and `--font-barlow`.

### 18.2 Code rules for UI
- Use tokens through Tailwind classes (`bg-card`, `text-muted-foreground`, `border-border`). No hex colors in components.
- Brand name comes from `config/brand.ts`.
- Status colors only through `OrderStatusBadge` and the ticket component.
- Components: one per file, props typed, under about 150 lines (see `CODING_STANDARDS.md`).
- Do not install another component or icon library without asking.
- Do not copy third-party themes wholesale. If a theme generator is used to explore values, the result must still match this file.

### 18.3 Where things live

```
frontend/src/
├─ app/globals.css                 tokens (18.1)
├─ components/ui/                  shadcn primitives, themed
├─ components/shared/              PageHeader, EmptyState, ErrorState, Money, DateTime, PermissionGate, ConfirmDialog
├─ features/order/views/           OrderStatusBadge.tsx, OrderTicket.tsx
├─ features/table/views/           TablePlate.tsx, TableGrid.tsx
├─ features/menu/views/            MenuItemRow.tsx, ItemOptionsSheet.tsx
├─ config/brand.ts                 name, support email, logo paths
└─ lib/format.ts                   money, date (AD and BS), number formatting
```

---

## 19. Design checklist (every frontend task)

- [ ] Uses only tokens, fonts, radii, shadows and components from this file
- [ ] One primary action per screen region; labels follow section 14
- [ ] Status shown with icon, label and color (never color alone)
- [ ] Loading, empty, error and offline states exist
- [ ] Targets are 44px or larger on touch screens (kitchen primary actions 64px)
- [ ] Works at 360px wide; no horizontal scroll except where specified
- [ ] Keyboard: tab order, visible focus, dialogs trap and restore focus
- [ ] Contrast meets section 6 and 16
- [ ] Nepali text renders correctly where menu content appears
- [ ] Money and dates use `lib/format.ts`
- [ ] No decoration that does not serve the task (no gradients, no hover lift, no entrance animations)
- [ ] Reduced motion respected
- [ ] Screenshots at mobile and desktop attached to the end-of-task report, and the user approves the look before the next task

---

## 20. Pending design decisions

Ask the user before the task listed. Recommendations are proposals. When answered, record in `DECISIONS.md`.

| ID | Topic | Options | Recommendation | Needed by |
|---|---|---|---|---|
| DS-001 | Brand color | A) Hearth teal `#0B5D66`; B) Deep blue `#1F4E9C`; C) Deep rose `#A3224E` (risks clashing with error red) | **A**, separate from status hues and calm | F-001 |
| DS-002 | Typefaces | A) Hind + Barlow Semi Condensed; B) Noto Sans Devanagari UI + Barlow; C) Mukta + Barlow | **A** after a specimen check with real Nepali menu names | F-001 |
| DS-003 | Tabular figures | Check Hind; if missing use Barlow for numeric columns | Verify in F-001 specimen | F-001 |
| DS-004 | Dark mode scope | A) Kitchen dark always + dashboard dark toggle; B) Kitchen dark only; C) Full dark everywhere | **A** | F-006 |
| DS-005 | Guest menu branding | A) Restaurant logo and name only; B) Also a custom accent color | **A** for v1 | F-010 |
| DS-006 | "Powered by Bansa" on guest pages and QR tents | A) Always; B) Hide on Custom plan | **B** | F-010 |
| DS-007 | Number format | A) `Rs 1,25,000` (lakh); B) `Rs 125,000` | **A** (local convention). Please confirm with a Nepali accountant or user | F-006 |
| DS-008 | Dates on bills and time format | A) AD and BS on bills, AD in dashboard, 12-hour clock; B) AD only. Needs a BS conversion library decision | **A**, ask before adding the library | PAY-007 |
| DS-009 | Receipt widths | A) 80mm and A4; B) also 58mm | **A** | PAY-007 |
| DS-010 | Logo and mark | A) Owner provides; B) Interim wordmark plus plate-ring mark | **B** until a logo exists | F-004 |
| DS-011 | Nepali menu names | A) One name field accepts both scripts; B) Add an optional second name field (`name_local`) | **A** for v1; B needs a schema change | M-002 |
| DS-012 | Order alert sound | A) Kitchen on by default with mute, waiter off; B) Off everywhere; C) On everywhere | **A**. Browsers require a first tap to allow audio | F-012 |
| DS-013 | Ticket age thresholds | Default amber at 10 min and red at 20 min; or derive from item prep time | **Derive from prep time with 10 and 20 minute defaults** | F-013 |

---

## 21. References

- Kitchen display design guides: https://vp0.com/blogs/restaurant-kitchen-display-system-kds-ui/ and https://vp0.com/blogs/restaurant-kds-kitchen-display-system-ipad-ui
- Toast KDS ticket appearance: https://support.toasttab.com/en/article/Customize-the-Appearance-of-KDS-Tickets?lang=en_US
- Restaurant display color coding: https://qsrautomations.com/?p=12926
- QR menu best practices: https://www.adobe.com/express/learn/blog/how-to-make-qr-code-menu
- QR table ordering flow: https://www.wpslash.com/?p=3334
- WCAG 2.2 target size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html and https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- Hind (Google Fonts): https://fonts.google.com/specimen/Hind/about
- Noto Sans Devanagari: https://www.figma.com/fonts/noto-sans-devanagari/
- shadcn/ui theming on Tailwind v4: https://ui.shadcn.com/docs/theming and https://www.cult-ui.com/docs/theming.md
- eSewa logo guidelines: https://cdn.esewa.com.np/ui/notice/Logo_Guidelines.pdf
- Nepal billing and VAT invoice requirements: https://pioneerlaw.com/?p=551 and https://notarynepal.com/blog/vat-rules-in-nepal and https://lookuptax.com/docs/country/nepal-vat-guidelines-indirect-tax

These are secondary sources for design guidance. Confirm legal and tax points with the Inland Revenue Department or an accountant before launch.
