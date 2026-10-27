import {AgentError,PROFILE_FIELDS} from "../contracts.js";
import {quoteAt,requirementId} from "../evidence.js";
// Public, fictional data only. Never replace these with a real person's CV.
export function mockExample(revision="demo-1") {
  return {schemaVersion:1,revision,
    posting:"[가상 예제 공고]\n필수조건\n- 보안 로그 분석 경험\n- Linux 운영 경험\n우대사항\n- SQLD 보유",
    profile:{goalJob:"보안 운영",education:"",experience:"학습 프로젝트에서 보안 로그를 분석했습니다. Linux 운영 경험은 없습니다.",certificates:"",skills:""}};
}
export function isMockExample(input) {
  const example=mockExample(input.revision);
  return input.posting===example.posting && PROFILE_FIELDS.every(key=>input.profile[key]===example.profile[key]);
}
export const mockAdapter=Object.freeze({
  async analyze(input) {
    if(!isMockExample(input)) throw new AgentError("MOCK_FIXTURE_ONLY",422);
    const postingRef=quote=>quoteAt(input,"posting","posting",quote,input.posting.indexOf(quote));
    const profileRef=quote=>quoteAt(input,"profile","experience",quote,input.profile.experience.indexOf(quote));
    const row=(quote,category,interpretation,importance,profileEvidence,relation,uncertainties,nextActions)=>{
      const ref=postingRef(quote);
      return {id:requirementId(ref),category,interpretation,importance,postingEvidence:[ref],profileEvidence,relation,uncertainties,nextActions};
    };
    return {schemaVersion:1,revision:input.revision,mode:"mock",label:"모의 결과 · 실제 AI 분석 아님",needsHumanReview:true,
      requirements:[
        row("보안 로그 분석 경험","required","로그를 분석한 경험을 요구하는 조건입니다.","공고의 필수조건 구간에 있습니다.",
          [profileRef("학습 프로젝트에서 보안 로그를 분석했습니다.")],"related",
          ["학습 프로젝트가 기업이 요구하는 경험으로 인정되는지는 확인 필요합니다."],
          ["분석 대상 로그, 사용 도구, 본인의 역할과 결과를 프로젝트 증빙으로 정리하세요."]),
        row("Linux 운영 경험","required","Linux를 실제로 운영한 경험에 관한 조건입니다.","공고의 필수조건 구간에 있습니다.",
          [profileRef("Linux 운영 경험은 없습니다.")],"explicit-gap",
          ["기업이 요구하는 운영 범위와 학습 실습의 인정 여부를 확인하세요."],
          ["Linux 실습에서 계정·권한·서비스·로그 관리 과정을 기록하세요. 실무 경력을 대체한다고 단정하지 마세요."]),
        row("SQLD 보유","preferred","SQLD 보유자를 우대하는 조건입니다.","공고의 우대사항 구간에 있습니다.",[],"not-stated",
          ["자격증 입력이 비어 있어 보유 여부를 알 수 없습니다."],
          ["실제 보유 여부를 확인하고 내 역량에 입력하세요. 미보유로 자동 판정하지 않습니다."])
      ]};
  }
});
