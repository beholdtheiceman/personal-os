// Shared builder for the shopping-list .docx, used by both the local-download
// export endpoint and the save-to-Drive endpoint so the document is identical.
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from "docx";

export type ShoppingListDocItem = {
  ingredient: string;
  amount: string;
  checked: boolean;
};

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function buildShoppingListDocx(
  weekStart: string,
  items: ShoppingListDocItem[]
): Promise<Buffer> {
  const remaining = items.filter((i) => !i.checked).length;

  const children: Paragraph[] = [
    new Paragraph({
      text: "Shopping List",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Week of ${weekStart}`, italics: true, size: 22 })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${items.length} item${items.length === 1 ? "" : "s"} · ${remaining} remaining`,
          color: "888888",
          size: 20,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
  ];

  if (items.length === 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "(No ingredients on this list.)", italics: true })],
      })
    );
  } else {
    for (const item of items) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: item.checked ? "☑  " : "☐  " }),
            new TextRun({
              text: capitalize(item.ingredient),
              strike: item.checked,
              color: item.checked ? "888888" : "000000",
            }),
            ...(item.amount
              ? [
                  new TextRun({
                    text: `  —  ${item.amount}`,
                    strike: item.checked,
                    color: item.checked ? "888888" : "555555",
                  }),
                ]
              : []),
          ],
        })
      );
    }
  }

  const doc = new Document({
    creator: "Personal OS",
    title: `Shopping List — Week of ${weekStart}`,
    sections: [{ properties: {}, children }],
  });

  return await Packer.toBuffer(doc);
}
