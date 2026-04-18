import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Register Arabic font (Cairo)
Font.register({
  family: "Cairo",
  src: "/fonts/Cairo-Regular.ttf",
});

Font.register({
  family: "Cairo",
  src: "/fonts/Cairo-Bold.ttf",
  fontWeight: "bold",
});

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    direction: "rtl",
    fontFamily: "Cairo",
  },
  header: {
    marginBottom: 20,
    textAlign: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 5,
  },
  date: {
    fontSize: 10,
    color: "#999999",
  },
  section: {
    marginBottom: 15,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  businessName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#1a1a1a",
  },
  businessDetails: {
    fontSize: 10,
    color: "#555555",
    marginBottom: 3,
  },
  phone: {
    fontSize: 10,
    color: "#0066cc",
  },
  address: {
    fontSize: 10,
    color: "#555555",
  },
  categoryBadge: {
    fontSize: 8,
    backgroundColor: "#e8f4ea",
    color: "#1e7e34",
    padding: 2,
    borderRadius: 3,
    alignSelf: "flex-start",
    marginTop: 5,
  },
  verifiedBadge: {
    fontSize: 8,
    backgroundColor: "#0066cc",
    color: "#ffffff",
    padding: 2,
    borderRadius: 3,
    marginRight: 5,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 8,
    color: "#999999",
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    paddingTop: 10,
  },
  pageNumber: {
    fontSize: 8,
    color: "#999999",
  },
});

interface Business {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  address?: string | null;
  phoneNumbers?: { number: string }[] | null;
  city?: { nameAr: string } | null;
  category?: { nameAr: string } | null;
  verifiedAt?: Date | null;
}

interface DirectoryDocumentProps {
  cityName: string;
  categoryName: string;
  businesses: Business[];
  generatedAt: Date;
  totalCount: number;
}

export const DirectoryDocument: React.FC<DirectoryDocumentProps> = ({
  cityName,
  categoryName,
  businesses,
  generatedAt,
  totalCount,
}) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{categoryName}</Text>
          <Text style={styles.subtitle}>{cityName}</Text>
          <Text style={styles.date}>تاريخ التقرير: {formatDate(generatedAt)}</Text>
          <Text style={styles.date}>عدد المؤسسات: {totalCount}</Text>
        </View>

        {/* Business Listings */}
        {businesses.map((business) => (
          <View key={business.id} style={styles.section}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {business.verifiedAt && (
                <Text style={styles.verifiedBadge}>✓ موثق</Text>
              )}
              <Text style={styles.businessName}>{business.nameAr}</Text>
            </View>

            {business.category && (
              <Text style={styles.categoryBadge}>{business.category.nameAr}</Text>
            )}

            {business.address && (
              <Text style={styles.address}>📍 {business.address}</Text>
            )}

            {business.phoneNumbers && business.phoneNumbers.length > 0 && (
              <Text style={styles.phone}>
                📞 {business.phoneNumbers.map((p) => p.number).join(" - ")}
              </Text>
            )}

            {business.city && (
              <Text style={styles.businessDetails}>🏙️ {business.city.nameAr}</Text>
            )}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>دليل المدن - دليل النبك</Text>
          <Text render={({ pageNumber, totalPages }) => `الصفحة ${pageNumber} من ${totalPages}`} style={styles.pageNumber} />
        </View>
      </Page>
    </Document>
  );
};