/* ONIX 3.0 message — universal trade-metadata XML. Used as the canonical
   trade-distribution payload (Ingram, IPG, OverDrive, library wholesalers,
   and Google Play upload accept ONIX). Minimal but valid ONIX 3.0 shape. */
import type { PublicationMetadata } from "../metadata";
import type { AdapterIssue } from "../metadata";
import { xmlEsc } from "./_shared";

export interface OnixPayload {
  format: "xml";
  mediaType: "application/xml";
  filename: string;
  body: string;
  issues: AdapterIssue[];
}

export function buildOnix(meta: PublicationMetadata, slug: string): OnixPayload {
  const issues: AdapterIssue[] = [];
  if (!meta.isbn) {
    issues.push({ level: "warning", field: "isbn", message: "ONIX 3.0 ProductIdentifier 15 (ISBN-13) recommended" });
  }
  if (!meta.publicationDate) {
    issues.push({ level: "warning", field: "publicationDate", message: "ONIX recommends a PublishingDate" });
  }
  const sentDate = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const contributors = [meta.author, ...meta.contributors].map((name, i) => `
    <Contributor>
      <SequenceNumber>${i + 1}</SequenceNumber>
      <ContributorRole>A01</ContributorRole>
      <PersonName>${xmlEsc(name)}</PersonName>
    </Contributor>`).join("");
  const subjects = meta.categories.map((c) => `
    <Subject>
      <SubjectSchemeIdentifier>10</SubjectSchemeIdentifier>
      <SubjectCode>${xmlEsc(c)}</SubjectCode>
    </Subject>`).join("");
  const keywords = meta.keywords.length
    ? `
    <Subject>
      <SubjectSchemeIdentifier>20</SubjectSchemeIdentifier>
      <SubjectHeadingText>${xmlEsc(meta.keywords.join("; "))}</SubjectHeadingText>
    </Subject>`
    : "";
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<ONIXMessage xmlns="http://ns.editeur.org/onix/3.0/reference" release="3.0">
  <Header>
    <Sender><SenderName>ASCEND Media</SenderName></Sender>
    <SentDateTime>${sentDate}</SentDateTime>
  </Header>
  <Product>
    <RecordReference>ascend-${xmlEsc(slug)}</RecordReference>
    <NotificationType>03</NotificationType>
    <ProductIdentifier>
      <ProductIDType>01</ProductIDType>
      <IDValue>ascend-${xmlEsc(slug)}</IDValue>
    </ProductIdentifier>${meta.isbn ? `
    <ProductIdentifier>
      <ProductIDType>15</ProductIDType>
      <IDValue>${xmlEsc(meta.isbn.replace(/[^0-9X]/gi, ""))}</IDValue>
    </ProductIdentifier>` : ""}
    <DescriptiveDetail>
      <ProductComposition>00</ProductComposition>
      <ProductForm>EB</ProductForm>
      <ProductFormDetail>E101</ProductFormDetail>
      <TitleDetail>
        <TitleType>01</TitleType>
        <TitleElement>
          <TitleElementLevel>01</TitleElementLevel>
          <TitleText>${xmlEsc(meta.title)}</TitleText>${meta.subtitle ? `
          <Subtitle>${xmlEsc(meta.subtitle)}</Subtitle>` : ""}
        </TitleElement>
      </TitleDetail>${contributors}
      <Language>
        <LanguageRole>01</LanguageRole>
        <LanguageCode>${xmlEsc(meta.language === "en" ? "eng" : meta.language)}</LanguageCode>
      </Language>${subjects}${keywords}
    </DescriptiveDetail>
    <CollateralDetail>
      <TextContent>
        <TextType>03</TextType>
        <ContentAudience>00</ContentAudience>
        <Text>${xmlEsc(meta.description)}</Text>
      </TextContent>
    </CollateralDetail>
    <PublishingDetail>
      <Imprint><ImprintName>${xmlEsc(meta.publisher)}</ImprintName></Imprint>
      <Publisher>
        <PublishingRole>01</PublishingRole>
        <PublisherName>${xmlEsc(meta.publisher)}</PublisherName>
      </Publisher>${meta.publicationDate ? `
      <PublishingDate>
        <PublishingDateRole>01</PublishingDateRole>
        <Date dateformat="00">${xmlEsc(meta.publicationDate.replace(/-/g, ""))}</Date>
      </PublishingDate>` : ""}
    </PublishingDetail>
  </Product>
</ONIXMessage>`;
  return {
    format: "xml",
    mediaType: "application/xml",
    filename: `${slug}.onix.xml`,
    body,
    issues,
  };
}
