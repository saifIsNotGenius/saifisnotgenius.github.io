---
layout: default
title: Saif's Blog
---

## Posts

<div class="post-list">
  {% for post in site.posts %}
    <article class="post">
      <h2>
        <a href="{{ post.url }}">{{ post.title }}</a>
      </h2>
      <p class="post-meta">{{ post.date | date: "%B %d, %Y" }}</p>
      <p class="post-excerpt">{{ post.excerpt | strip_html | truncatewords: 160 }}</p>
      <a class="read-more" href="{{ post.url }}">Read More</a>
    </article>
  {% endfor %}
</div>
