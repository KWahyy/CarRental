import { json, requireEmployee, serverConfig, setCors } from "./_invoice-core.js";
import { agreementId, getAgreement } from "./_agreement-core.js";
import { createAgreementPdf } from "./_agreement-pdf.js";

export default async function handler(req,res){
  setCors(req,res); if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method!=="GET") return json(res,405,{error:"Method not allowed."});
  try{const {token}=await requireEmployee(req); const agreement=await getAgreement(agreementId(req.query?.id),token);let bytes;if(agreement.signed_pdf_path){const {url,key}=serverConfig();const stored=await fetch(`${url}/storage/v1/object/authenticated/rental-documents/${agreement.signed_pdf_path}`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});if(stored.ok)bytes=Buffer.from(await stored.arrayBuffer());}if(!bytes)bytes=Buffer.from(await createAgreementPdf(agreement));res.status(200);res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`attachment; filename="${agreement.agreement_number||"rental-agreement"}.pdf"`);return res.end(bytes);}
  catch(error){return json(res,error.status||500,{error:error.message||"Could not create agreement PDF."});}
}
