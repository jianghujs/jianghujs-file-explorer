'use strict';

module.exports.tableEnum = Object.freeze({
  // ========================江湖表============================
  _cache: "_cache",
  _constant: "_constant",
  _constant_ui: "_constant_ui",
  _file: "_file",
  _group: "_group",
  _page: "_page",
  _record_history: "_record_history",
  _resource: "_resource",
  _resource_request_log: "_resource_request_log",
  _role: "_role",
  _user: "_user",
  _user_group_role: "_user_group_role",
  _user_group_role_page: "_user_group_role_page",
  _user_group_role_resource: "_user_group_role_resource",
  _user_session: "_user_session",
  // ========================基础表============================
  article_favorite: "article_favorite",
  article_info: "article_info",
  article_view: "article_view",
  assignment: "assignment",
  student_behavior: "behavior",
  note: "note",
  // ========================基础View============================
  // ========================View============================
  _view01_user: "_view01_user",
  album: "album",
  album_article: "album_article",
  baofeng_group_album: "baofeng_group_album",
  baofeng_user_group_role: "baofeng_user_group_role",
  view01_article_detail: "view01_article_detail",
  view01_article: "view01_article",
  view01_category: "view01_category",
  view01_article_favorite: "view01_article_favorite",
  view01_article_note: "view01_article_note",
  view01_assignment: "view01_assignment",
  view01_assignment_review: "view01_assignment_review",
  view01_user_group_album: "view01_user_group_album",
  view01_cloud_drive: "view01_cloud_drive",
  view02_article_comment_user: "view02_article_comment_user",
  baofeng_user_article: "view01_baofeng_user_group_role_album_article",
});

module.exports.genderEnum = Object.freeze({
  male: 'male',
  female: 'female'
})

module.exports.articleViewTypeEnum = Object.freeze({
  content: 'content',
  audio: 'audio',
  video: 'video',
})
