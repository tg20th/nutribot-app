import CommunityPostCard from '../components/community/CommunityPostCard';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import colorfulPlate from '../assets/colorful-plate.jpg';
import '../styles/nb26-review.css';

let liked = false;
let nextId = 4;
const comments = [
  { commentId: 1, userName: 'Minh Anh', body: 'Mình đã thử công thức này cho bữa trưa. Dễ làm và rất hợp khẩu vị!', createdAt: '2026-09-25T09:30:00Z',
    replies: [{ commentId: 2, userName: 'Lan Phương', body: 'Bạn có thay sữa chua bằng nguyên liệu khác không?', createdAt: '2026-09-25T10:15:00Z' }] },
  { commentId: 3, userName: 'Tuấn Kiệt', body: 'Phần gợi ý dinh dưỡng rất hữu ích. Cảm ơn bạn đã chia sẻ.', createdAt: '2026-09-26T02:00:00Z', replies: [] },
];
const loadVote = async () => ({ voteCount: 24 + Number(liked), isVoted: liked });
const submitVote = async () => { liked = !liked; return loadVote(); };
const loadComments = async () => ({ content: structuredClone(comments), totalElements: comments.length, totalPages: 1 });
const submitComment = async (_id, body, parentId) => {
  const created = { commentId: nextId++, userName: 'Bạn', body, createdAt: new Date().toISOString(), replies: [] };
  if (parentId == null) comments.unshift(created);
  else comments.find((comment) => comment.commentId === parentId)?.replies.push(created);
  return created;
};
const samplePost = {
  id: 26, author: 'Minh Anh', username: '@minhanh', createdAt: '26/09/2026',
  avatar: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#dcead4"/><text x="32" y="40" text-anchor="middle" font-size="22" fill="#315c2b">MA</text></svg>'),
  type: 'blog', title: 'Bữa ăn cân bằng cho ngày bận rộn', image: colorfulPlate,
  description: 'Một bữa ăn đơn giản với rau xanh, ngũ cốc nguyên hạt và nguồn đạm phù hợp giúp bạn duy trì năng lượng trong ngày.',
  body: 'Hôm nay mình chia sẻ một bữa trưa dễ chuẩn bị: rau xanh, cơm gạo lứt và đậu hũ.\n\nMình thường sơ chế nguyên liệu từ tối hôm trước. Đến giờ ăn chỉ cần làm nóng, thêm sốt sữa chua và một ít hạt rang.\n\nBạn thường chuẩn bị bữa trưa như thế nào? Cùng chia sẻ ở phần bình luận nhé!',
  shares: 3, calories: 420, protein: 24,
};
const loadSamplePost = async () => samplePost;
const interactionApi = { loadVote, submitVote, loadComments, submitComment };

export default function NB26ReviewPage() {
  return <div className="community-page nb26-review-feed">
    <CommunityTopBar hideSearch/>
    <div className="community-shell">
      <CommunitySideNav/>
      <span className="community-sidenav-spacer" aria-hidden="true"/>
      <div className="community-layout">
        <main className="community-feed">
          <div className="nb26-review-hint"><strong>Review NB-26</strong><p>Bấm bài đăng, ảnh hoặc Comments để mở hộp thoại giữa màn hình. Dữ liệu mẫu chỉ dùng để xem thử.</p></div>
          <CommunityPostCard post={samplePost} interactionApi={interactionApi} loadPost={loadSamplePost}/>
        </main>
        <aside className="community-right-rail">
          <div className="community-widget"><div className="community-widget-head"><b>Trending in the Community</b></div><ul className="community-hashtags"><li>#BalancedMeals</li><li>#MealPrep</li><li>#HealthyLiving</li></ul></div>
          <div className="community-widget"><div className="community-widget-head"><b>Today's inspiration</b></div><p>Fresh ingredients. Simple meals. Shared together.</p></div>
        </aside>
      </div>
    </div>
  </div>;
}

