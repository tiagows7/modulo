import forge from "node-forge";

/** Valida PFX/senha com node-forge antes do mTLS (evita crash nativo na Vercel). */
export function assertValidPfx(pfx: Buffer, passphrase: string) {
  if (!pfx?.length) throw new Error("Certificado A1 (PFX) não informado.");
  if (!passphrase) throw new Error("Senha do certificado não informada.");
  try {
    const binary = forge.util.createBuffer(pfx.toString("binary"));
    const asn1 = forge.asn1.fromDer(binary);
    forge.pkcs12.pkcs12FromAsn1(asn1, false, passphrase);
  } catch {
    throw new Error(
      "Certificado A1 inválido ou senha incorreta. Reenvie o .pfx e confira a senha na filial.",
    );
  }
}
