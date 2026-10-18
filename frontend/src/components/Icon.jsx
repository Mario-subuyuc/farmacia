import { Activity, ArrowLeftRight, Banknote, Building2, ClipboardCheck, ContactRound, Headset,
  LayoutDashboard, ListChecks, Monitor, Package, Pill, ReceiptText, ShieldCheck, ShoppingBag,
  Truck, UsersRound, Wallet, ChartNoAxesCombined, FileText, Ticket, Bell, CalendarDays } from 'lucide-react';

const icons = { Activity, ArrowLeftRight, Banknote, Building2, ClipboardCheck, ContactRound, Headset,
  LayoutDashboard, ListChecks, Monitor, Package, Pill, ReceiptText, ShieldCheck, ShoppingBag,
  Truck, UsersRound, Wallet, ChartNoAxesCombined };
export default function Icon({ name, size = 20, ...props }) {
  const Component = icons[name] || Activity;
  return <Component size={size} strokeWidth={1.7} aria-hidden="true" {...props} />;
}
