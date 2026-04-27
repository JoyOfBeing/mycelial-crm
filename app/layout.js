import { AuthProvider } from "../components/AuthProvider";
import "./globals.css";

export const metadata = {
  title: "MycelialCRM",
  description: "Jumpsuit relationship manager",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
