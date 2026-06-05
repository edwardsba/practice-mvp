import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import type { CrisisPlanPdfData } from "@/lib/crisis-plan/build-pdf-data"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111111",
    lineHeight: 1.4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 11,
    marginBottom: 20,
    color: "#444444",
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    marginTop: 12,
  },
  twoColumn: {
    flexDirection: "row",
    gap: 20,
  },
  column: {
    flex: 1,
  },
  bullet: {
    marginBottom: 4,
    paddingLeft: 8,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    paddingBottom: 4,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  colRole: { width: "18%" },
  colName: { width: "24%" },
  colPhone: { width: "24%" },
  colEmail: { width: "34%" },
  muted: {
    color: "#666666",
    fontStyle: "italic",
  },
})

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <Text style={styles.muted}>None selected</Text>
  }

  return (
    <>
      {items.map((item, index) => (
        <Text key={`${index}-${item}`} style={styles.bullet}>
          • {item}
        </Text>
      ))}
    </>
  )
}

function ColumnSection({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  return (
    <View style={styles.column}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <BulletList items={items} />
    </View>
  )
}

export function CrisisPlanPdfDocument({ data }: { data: CrisisPlanPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Crisis Plan</Text>
        <Text style={styles.subtitle}>
          {data.clientName} — {data.dateOfPlan}
        </Text>

        <Text style={styles.sectionTitle}>Emergency Contacts</Text>
        {data.contacts.length === 0 ? (
          <Text style={styles.muted}>No emergency contacts listed.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={styles.colRole}>Role</Text>
              <Text style={styles.colName}>Name</Text>
              <Text style={styles.colPhone}>Phone</Text>
              <Text style={styles.colEmail}>Email</Text>
            </View>
            {data.contacts.map((contact, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.colRole}>{contact.role || "—"}</Text>
                <Text style={styles.colName}>{contact.name}</Text>
                <Text style={styles.colPhone}>{contact.phone || "—"}</Text>
                <Text style={styles.colEmail}>{contact.email || "—"}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Emergency Numbers</Text>
        <BulletList items={data.emergencyNumbers} />

        <Text style={styles.sectionTitle}>Doing Well / Staying Well</Text>
        <View style={styles.twoColumn}>
          <ColumnSection
            title="Signs that I am doing well"
            items={data.doingWell}
          />
          <ColumnSection
            title="Things I need to do to stay well"
            items={data.stayWell}
          />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Becoming Unwell / Getting Better</Text>
        <View style={styles.twoColumn}>
          <ColumnSection
            title="Signs that I am becoming unwell"
            items={data.becomingUnwell}
          />
          <ColumnSection
            title="Things I need to do to get better"
            items={data.getBetter}
          />
        </View>

        <Text style={styles.sectionTitle}>Unwell / Crisis Response</Text>
        <View style={styles.twoColumn}>
          <ColumnSection
            title="Signs that I am unwell or in crisis"
            items={data.unwell}
          />
          <ColumnSection
            title="Things to do when I am unwell"
            items={data.crisisResponse}
          />
        </View>
      </Page>
    </Document>
  )
}
