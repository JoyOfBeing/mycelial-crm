import { AuthProvider } from "../components/AuthProvider";
import ChatWidget from "../components/ChatWidget";
import "./globals.css";

export const metadata = {
  title: "JumpsuitCRM",
  description: "Jumpsuit relationship manager",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
