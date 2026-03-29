import { processNeighborAutoLike } from './lib/naver/blog-automation';

/**
 * 테스트 스크립트: 네이버 블로그 이웃 자동 좋아요
 */
async function testNeighborAutoLike() {
  console.log('=====================================');
  console.log('🧪 이웃 자동 좋아요 테스트 시작');
  console.log('=====================================\n');

  try {
    // 테스트 계정
    const blogId = 'skaukjh';
    const blogPassword = 'wogns0513@';
    const daysLimit = 7;
    const maxNeighbors = 3; // 테스트용으로 3명만

    console.log('📋 테스트 설정:');
    console.log(`   - 블로그 ID: ${blogId}`);
    console.log(`   - 확인 기간: 최근 ${daysLimit}일`);
    console.log(`   - 이웃 제한: ${maxNeighbors}명\n`);

    console.log('🚀 프로세스 시작...\n');

    // 실제 프로세스 실행
    const result = await processNeighborAutoLike(blogId, blogPassword, daysLimit, maxNeighbors);

    console.log('\n=====================================');
    console.log('📊 최종 결과:');
    console.log('=====================================');
    console.log(`✅ 성공: ${result.success ? '예' : '아니오'}`);
    console.log(`📄 처리된 글: ${result.totalProcessed}개`);
    console.log(`❤️ 좋아요 완료: ${result.totalLiked}개`);
    console.log(`⏱️ 소요 시간: ${Math.round(
      (new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()) / 1000
    )}초\n`);

    if (result.neighborStats.length > 0) {
      console.log('👥 이웃별 처리 결과:');
      result.neighborStats.forEach((stat) => {
        console.log(`   - ${stat.nickname}: ${stat.postsLiked}/${stat.postsProcessed}개 좋아요`);
      });
    }

    if (result.errors.length > 0) {
      console.log('\n⚠️ 오류:');
      result.errors.forEach((err) => {
        console.log(`   - ${err}`);
      });
    }

    console.log('\n=====================================');
    console.log('✅ 테스트 완료');
    console.log('=====================================');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 테스트 실패:');
    console.error(error);
    process.exit(1);
  }
}

// 테스트 실행
testNeighborAutoLike();
